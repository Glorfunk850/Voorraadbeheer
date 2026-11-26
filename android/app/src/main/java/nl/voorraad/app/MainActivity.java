package nl.voorraad.app;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Collections;

/**
 * De webapp Voorraadbeheer als Android-app. De bestanden zitten in de apk (assets/www) en worden geladen via
 * https://appassets.androidplatform.net/www/, zodat opslag, service worker en fetch werken zoals in Chrome.
 */
public class MainActivity extends Activity {
    private static final String START = "https://appassets.androidplatform.net/www/index.html";
    private static final int KIES_BESTAND = 1;
    private static final int CAMERA = 2;

    private WebView web;
    private WebViewAssetLoader lader;
    private ValueCallback<Uri[]> bestandTerug;
    private PermissionRequest cameraVraag;

    private static final int MELDINGEN = 4;
    private String brugJs = "";

    /** brug.js uit de apk lezen (vult aan wat de WebView niet kan: downloads, afdrukken, scherm aan, meldingen). */
    private String brugLezen() {
        try (java.io.InputStream in = getAssets().open("brug.js")) {
            java.io.ByteArrayOutputStream uit = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            for (int n; (n = in.read(buf)) > 0; ) uit.write(buf, 0, n);
            return uit.toString("UTF-8");
        } catch (java.io.IOException e) { return ""; }
    }

    @Override
    protected void onCreate(Bundle opgeslagen) {
        super.onCreate(opgeslagen);
        lader = new WebViewAssetLoader.Builder()
            .addPathHandler("/www/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);

        brugJs = brugLezen();
        web.addJavascriptInterface(new Brug(), "VoorraadApp");
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, brugJs, Collections.singleton("https://appassets.androidplatform.net"));
        }

        if (Build.VERSION.SDK_INT >= 24) {
            ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest req) {
                    return lader.shouldInterceptRequest(req.getUrl());
                }
            });
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return lader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { /* niets */ }
                return true;
            }

            @Override
            public void onPageStarted(WebView v, String url, android.graphics.Bitmap icoon) {
                // oudere WebView zonder DOCUMENT_START_SCRIPT
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) v.evaluateJavascript(brugJs, null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> terug, FileChooserParams p) {
                if (bestandTerug != null) bestandTerug.onReceiveValue(null);
                bestandTerug = terug;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String[] soorten = p.getAcceptTypes();
                String soort = (soorten != null && soorten.length > 0 && soorten[0] != null && soorten[0].contains("/")) ? soorten[0] : "*/*";
                i.setType(soort);
                try {
                    startActivityForResult(Intent.createChooser(i, "Kies een bestand"), KIES_BESTAND);
                } catch (ActivityNotFoundException e) {
                    bestandTerug = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest vraag) {
                boolean camera = false;
                for (String r : vraag.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) camera = true;
                if (!camera) { vraag.deny(); return; }
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    vraag.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                } else {
                    cameraVraag = vraag;
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA);
                }
            }
        });

        if (opgeslagen != null) web.restoreState(opgeslagen);
        else web.loadUrl(START + viewVan(getIntent()));
    }

    /** Getikt op een melding: "#voorraad" (anders leeg). */
    private static String viewVan(Intent i) {
        String v = i == null ? null : i.getStringExtra("view");
        return v != null && v.matches("[a-z]+") ? "#" + v : "";
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        String v = viewVan(i);
        if (!v.isEmpty()) web.evaluateJavascript("location.hash='" + v + "'", null);
    }

    /** Toestemming voor meldingen zoals Notification.permission: granted, denied of default. */
    private String toestemming() {
        if (Melder.magMelden(this)) return "granted";
        if (Build.VERSION.SDK_INT >= 33) {
            boolean gevraagd = Melder.prefs(this).getBoolean("gevraagd", false);
            if (!gevraagd || shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) return "default";
        }
        return "denied";
    }

    private void toestemmingTerug() {
        web.evaluateJavascript("window.__voorraadToestemming&&window.__voorraadToestemming('" + toestemming() + "')", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle uit) {
        super.onSaveInstanceState(uit);
        web.saveState(uit);
    }

    @Override
    protected void onActivityResult(int code, int resultaat, Intent data) {
        if (code == KIES_BESTAND && bestandTerug != null) {
            Uri[] gekozen = null;
            if (resultaat == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    gekozen = new Uri[data.getClipData().getItemCount()];
                    for (int k = 0; k < gekozen.length; k++) gekozen[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) {
                    gekozen = new Uri[]{data.getData()};
                }
            }
            bestandTerug.onReceiveValue(gekozen);
            bestandTerug = null;
            return;
        }
        super.onActivityResult(code, resultaat, data);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] rechten, int[] antwoord) {
        if (code == MELDINGEN) { toestemmingTerug(); return; }
        if (code == CAMERA && cameraVraag != null) {
            if (antwoord.length > 0 && antwoord[0] == PackageManager.PERMISSION_GRANTED) {
                cameraVraag.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                cameraVraag.deny();
            }
            cameraVraag = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private class Brug {
        @JavascriptInterface
        public boolean toon(String titel, String tekst) { return Melder.toon(MainActivity.this, titel, tekst); }

        @JavascriptInterface
        public String toestemming() { return MainActivity.this.toestemming(); }

        @JavascriptInterface
        public void vraagToestemming() {
            runOnUiThread(() -> {
                String t = MainActivity.this.toestemming();
                if (Build.VERSION.SDK_INT >= 33 && "default".equals(t)) {
                    Melder.prefs(MainActivity.this).edit().putBoolean("gevraagd", true).apply();
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, MELDINGEN);
                } else {
                    toestemmingTerug();
                }
            });
        }

        @JavascriptInterface
        public void achtergrond(boolean aan) { Melder.achtergrond(MainActivity.this, aan); }

        @JavascriptInterface
        public boolean achtergrondAan() { return Melder.prefs(MainActivity.this).getBoolean("achtergrond", false); }

        /** Voorraad en keuze aan/uit voor de melding (JSON uit brug.js). */
        @JavascriptInterface
        public void staat(String json) { Melder.prefs(MainActivity.this).edit().putString("staat", json).apply(); }

        @JavascriptInterface
        public void opslaan(String naam, String soort, String base64) {
            try {
                byte[] inhoud = Base64.decode(base64, Base64.DEFAULT);
                naam = naam.replaceAll("[\\\\/:*?\"<>|]", "_");
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues w = new ContentValues();
                    w.put(MediaStore.Downloads.DISPLAY_NAME, naam);
                    w.put(MediaStore.Downloads.MIME_TYPE, soort);
                    w.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, w);
                    if (u == null) throw new Exception("geen plaats in Downloads");
                    try (OutputStream o = getContentResolver().openOutputStream(u)) { o.write(inhoud); }
                } else {
                    if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 3);
                        throw new Exception("geef eerst toestemming en probeer opnieuw");
                    }
                    File map = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    map.mkdirs();
                    try (OutputStream o = new FileOutputStream(new File(map, naam))) { o.write(inhoud); }
                }
                melding("Opgeslagen in Downloads: " + naam);
            } catch (Exception e) {
                melding("Opslaan lukte niet: " + e.getMessage());
            }
        }

        @JavascriptInterface
        public void melding(String tekst) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, tekst, Toast.LENGTH_LONG).show());
        }

        @JavascriptInterface
        public void schermAan(boolean aan) {
            runOnUiThread(() -> {
                if (aan) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void afdrukken() {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                PrintDocumentAdapter binnen = web.createPrintDocumentAdapter("Voorraad");
                PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                    @Override public void onStart() { binnen.onStart(); }
                    @Override public void onLayout(PrintAttributes oud, PrintAttributes nieuw, CancellationSignal st, LayoutResultCallback cb, Bundle extra) { binnen.onLayout(oud, nieuw, st, cb, extra); }
                    @Override public void onWrite(PageRange[] p, ParcelFileDescriptor d, CancellationSignal st, WriteResultCallback cb) { binnen.onWrite(p, d, st, cb); }
                    @Override public void onFinish() {
                        binnen.onFinish();
                        web.evaluateJavascript("window.dispatchEvent(new Event('afterprint'))", null);
                    }
                };
                pm.print("Voorraad", adapter, new PrintAttributes.Builder().build());
            });
        }
    }
}
