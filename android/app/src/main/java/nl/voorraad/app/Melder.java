package nl.voorraad.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Melding als een product op moet, ook als de app dicht is. Zelfde regels als opTeGebruikenMelden() in sw.js:
 * hoogstens één melding per dag, en geen melding als je de app vandaag al opende (en het venster zag).
 * De webapp geeft via brug.js de voorraad en de keuze aan/uit door; die staan in SharedPreferences.
 */
public class Melder extends Worker {
    static final String KANAAL = "op-te-gebruiken";
    static final String TAAK = "op-te-gebruiken";
    static final String PREFS = "melding";
    private static final int ID = 1;

    public Melder(@NonNull Context c, @NonNull WorkerParameters p) { super(c, p); }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** Ongeveer twee keer per dag nakijken (Android kiest het juiste moment), of daarmee stoppen. */
    static void achtergrond(Context c, boolean aan) {
        prefs(c).edit().putBoolean("achtergrond", aan).apply();
        WorkManager wm = WorkManager.getInstance(c);
        if (aan) {
            wm.enqueueUniquePeriodicWork(TAAK, ExistingPeriodicWorkPolicy.KEEP,
                new PeriodicWorkRequest.Builder(Melder.class, 12, TimeUnit.HOURS).build());
        } else {
            wm.cancelUniqueWork(TAAK);
        }
    }

    static boolean magMelden(Context c) {
        if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        return c.getSystemService(NotificationManager.class).areNotificationsEnabled();
    }

    static void kanaal(Context c) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel k = new NotificationChannel(KANAAL, "Op te gebruiken", NotificationManager.IMPORTANCE_DEFAULT);
            k.setDescription("Als een product bijna of al voorbij de datum is");
            c.getSystemService(NotificationManager.class).createNotificationChannel(k);
        }
    }

    /** Een melding tonen; tik erop en de app opent bij de voorraad. */
    static boolean toon(Context c, String titel, String tekst) {
        if (!magMelden(c)) return false;
        kanaal(c);
        Intent i = new Intent(c, MainActivity.class).putExtra("view", "voorraad")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        android.app.Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new android.app.Notification.Builder(c, KANAAL) : new android.app.Notification.Builder(c);
        b.setSmallIcon(R.drawable.ic_melding).setContentTitle(titel).setContentText(tekst)
            .setStyle(new android.app.Notification.BigTextStyle().bigText(tekst))
            .setColor(0xFF2F6B4F).setContentIntent(pi).setAutoCancel(true);
        c.getSystemService(NotificationManager.class).notify(ID, b.build());
        return true;
    }

    private static String wanneer(long d) {
        return d == 0 ? "vandaag" : d == 1 ? "morgen" : d == -1 ? "gisteren" : d < 0 ? (-d) + " dagen geleden" : "over " + d + " dagen";
    }

    /** Nakijken en zo nodig melden. Openbaar, zodat het ook te testen is. */
    static void nakijken(Context c) throws Exception {
        SharedPreferences p = prefs(c);
        JSONObject staat = new JSONObject(p.getString("staat", "{}"));
        String vandaag = LocalDate.now().toString();
        if (!staat.optBoolean("aan") || !p.getBoolean("achtergrond", false)) return;
        if (vandaag.equals(staat.optString("laatst")) || vandaag.equals(p.getString("laatst", ""))) return;
        int tgt = staat.optInt("tgt_dagen", 2), tht = staat.optInt("tht_dagen", 3);
        JSONArray lijst = staat.optJSONArray("producten");
        if (lijst == null) return;
        // { naam, kort, niveau, datum }
        List<Object[]> op = new ArrayList<>();
        for (int k = 0; k < lijst.length(); k++) {
            JSONObject pr = lijst.getJSONObject(k);
            long d;
            try { d = ChronoUnit.DAYS.between(LocalDate.now(), LocalDate.parse(pr.getString("vervaldatum"))); } catch (Exception e) { continue; }
            String kort = null; int niveau = 0;
            if ("TGT".equals(pr.optString("datumtype"))) {
                if (d < 0) { niveau = 4; kort = "verlopen"; } else if (d <= tgt) { niveau = 3; kort = wanneer(d); }
            } else {
                if (d < 0) { niveau = 2; kort = "datum voorbij"; } else if (d <= tht) { niveau = 1; kort = wanneer(d); }
            }
            if (kort != null) op.add(new Object[]{pr.optString("naam"), kort, niveau, pr.getString("vervaldatum")});
        }
        if (op.isEmpty()) return;
        op.sort((a, b) -> {
            int x = Boolean.compare((int) b[2] >= 3, (int) a[2] >= 3);
            return x != 0 ? x : ((String) a[3]).compareTo((String) b[3]);
        });
        String titel = op.size() == 1 ? op.get(0)[0] + " op te gebruiken" : op.size() + " producten op te gebruiken";
        StringBuilder t = new StringBuilder();
        for (int k = 0; k < Math.min(4, op.size()); k++) { if (k > 0) t.append(" · "); t.append(op.get(k)[0]).append(": ").append(op.get(k)[1]); }
        if (op.size() > 4) t.append(" · en nog ").append(op.size() - 4);
        if (toon(c, titel, t.toString())) p.edit().putString("laatst", vandaag).apply();
    }

    @NonNull
    @Override
    public Result doWork() {
        try { nakijken(getApplicationContext()); } catch (Exception e) { /* volgende keer opnieuw */ }
        return Result.success();
    }
}
