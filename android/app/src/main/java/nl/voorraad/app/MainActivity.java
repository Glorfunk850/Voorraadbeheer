package nl.voorraad.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Toont de webapp (uit de assets/www-map) in een WebView.
 * De pagina draait op https://appassets.androidplatform.net, zodat IndexedDB en localStorage
 * gewoon werken en de gegevens op het toestel bewaard blijven.
 */
public class MainActivity extends Activity {

    private static final String DOMEIN = "appassets.androidplatform.net";
    private static final String START = "https://" + DOMEIN + "/www/index.html";
    private static final int KIES_BESTAND = 1;
    private static final int BEWAAR_BESTAND = 2;

    private WebView web;
    private ValueCallback<Uri[]> bestandTerug;
    private String teBewarenInhoud;

    @Override
    protected void onCreate(Bundle bewaard) {
        super.onCreate(bewaard);

        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        final WebViewAssetLoader lader = new WebViewAssetLoader.Builder()
                .setDomain(DOMEIN)
                .addPathHandler("/www/", this::assetLaden)
                .build();

        web.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return lader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (DOMEIN.equals(u.getHost())) return false;
                // links naar buiten openen in de browser
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { /* */ }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> terug, FileChooserParams p) {
                if (bestandTerug != null) bestandTerug.onReceiveValue(null);
                bestandTerug = terug;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                String[] soorten = p.getAcceptTypes();
                if (soorten != null && String.join(",", soorten).contains("pdf")) {
                    i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf"});
                }
                if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(Intent.createChooser(i, "Bestand kiezen"), KIES_BESTAND);
                } catch (ActivityNotFoundException e) {
                    bestandTerug = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Brug(), "AndroidApp");

        if (bewaard != null) web.restoreState(bewaard);
        else web.loadUrl(START);
    }

    /** Leest een bestand uit assets/www met het juiste type (ook .mjs en .wasm). */
    private WebResourceResponse assetLaden(String pad) {
        if (pad.isEmpty() || pad.endsWith("/")) pad += "index.html";
        try {
            InputStream in = getAssets().open("www/" + pad);
            return new WebResourceResponse(soort(pad), null, in);
        } catch (IOException e) {
            WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", null);
            r.setStatusCodeAndReasonPhrase(404, "Not Found");
            return r;
        }
    }

    private static String soort(String pad) {
        String ext = pad.substring(pad.lastIndexOf('.') + 1).toLowerCase();
        switch (ext) {
            case "html": return "text/html";
            case "js": case "mjs": return "text/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "webmanifest": return "application/manifest+json";
            case "wasm": return "application/wasm";
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "ttf": return "font/ttf";
            default:
                String m = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                return m != null ? m : "application/octet-stream";
        }
    }

    /** Wordt vanuit lokaal.js aangeroepen om een back-up of CSV als bestand te bewaren. */
    private class Brug {
        @JavascriptInterface
        public void bewaar(String naam, String type, String inhoud) {
            runOnUiThread(() -> {
                teBewarenInhoud = inhoud;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(type == null || type.isEmpty() ? "application/octet-stream" : type.split(";")[0]);
                i.putExtra(Intent.EXTRA_TITLE, naam);
                try {
                    startActivityForResult(i, BEWAAR_BESTAND);
                } catch (ActivityNotFoundException e) {
                    teBewarenInhoud = null;
                    Toast.makeText(MainActivity.this, "Bewaren lukt niet op dit toestel", Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int vraag, int uitkomst, Intent data) {
        super.onActivityResult(vraag, uitkomst, data);
        if (vraag == KIES_BESTAND) {
            if (bestandTerug == null) return;
            Uri[] gekozen = null;
            if (uitkomst == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    gekozen = new Uri[n];
                    for (int k = 0; k < n; k++) gekozen[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) {
                    gekozen = new Uri[]{data.getData()};
                }
            }
            bestandTerug.onReceiveValue(gekozen);
            bestandTerug = null;
        } else if (vraag == BEWAAR_BESTAND) {
            String inhoud = teBewarenInhoud;
            teBewarenInhoud = null;
            if (uitkomst != RESULT_OK || data == null || data.getData() == null || inhoud == null) return;
            try (OutputStream uit = getContentResolver().openOutputStream(data.getData(), "wt")) {
                if (uit == null) throw new IOException("geen uitvoer");
                uit.write(inhoud.getBytes(StandardCharsets.UTF_8));
                Toast.makeText(this, "Bewaard", Toast.LENGTH_SHORT).show();
            } catch (IOException e) {
                Toast.makeText(this, "Bewaren mislukt: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle uit) {
        super.onSaveInstanceState(uit);
        web.saveState(uit);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
