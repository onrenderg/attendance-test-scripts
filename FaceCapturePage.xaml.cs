using System.Web;

namespace VectorP;

public partial class FaceCapturePage : ContentPage
{
    public static string? CapturedImageBase64 { get; set; }
    public static bool WasCaptured { get; set; } = false;
    private string _referenceImage;

    private bool _webViewLoaded = false;

    public FaceCapturePage(string registeredImg = "")
    {
        _referenceImage = registeredImg;
        InitializeComponent();
        // Don't load WebView here - wait for permission
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        
        if (_webViewLoaded) return;
        
        // Request camera permission first (required for Android 6.0+)
#if ANDROID
        var status = await Permissions.CheckStatusAsync<Permissions.Camera>();
        if (status != PermissionStatus.Granted)
        {
            status = await Permissions.RequestAsync<Permissions.Camera>();
        }
        
        if (status == PermissionStatus.Granted)
        {
            _webViewLoaded = true;
            LoadWebView();
        }
        else
        {
            await DisplayAlert("Permission Required", "Camera permission is required for face verification.", "OK");
        }
#else
        _webViewLoaded = true;
        LoadWebView();
#endif
    }

    protected override async void OnDisappearing()
    {
        base.OnDisappearing();

        // Release camera when leaving page
        try
        {
            await webView.EvaluateJavaScriptAsync("stopCamera()");
        }
        catch { /* Ignore if JS not ready */ }
    }

    private void LoadWebView()
    {
#if ANDROID
        webView.Source = "file:///android_asset/wwwroot/index.html";
#else
        webView.Source = "wwwroot/index.html";
#endif
    }

    private void OnWebViewNavigating(object? sender, WebNavigatingEventArgs e)
    {
        if (e.Url.StartsWith("callback://"))
        {
            e.Cancel = true;

            try
            {
                var uri = new Uri(e.Url);
                var callbackType = uri.Host;
                var query = HttpUtility.ParseQueryString(uri.Query);

                switch (callbackType)
                {
                    case "match":
                        HandleMatchResult(
                            query["name"] ?? "",
                            query["confidence"] ?? "0",
                            query["isMatch"] == "true",
                            query["hasImage"] == "true"
                        );
                        break;
                    case "notmatch":
                        HandleMatchResult(
                            query["name"] ?? "",
                            query["confidence"] ?? "0",
                            false,
                            query["hasImage"] == "true"
                        );
                        break;

                    case "ready":
                        System.Diagnostics.Debug.WriteLine("[FaceApp] WebView ready");
                        // Register the reference image passed from ScanQrDetailsPage
                        if (!string.IsNullOrEmpty(_referenceImage))
                        {
                            // Ensure clean base64
                            var cleanBase64 = _referenceImage.Replace("\n", "").Replace("\r", "");
                            // Execute JS to register
                            MainThread.BeginInvokeOnMainThread(async () =>
                            {
                                await webView.EvaluateJavaScriptAsync($"registerExternalImage('{cleanBase64}', 'Test')");
                            });
                        }
                        break;

                    case "error":
                        System.Diagnostics.Debug.WriteLine($"[FaceApp] Error: {query["message"]}");
                        break;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[FaceApp] Callback error: {ex.Message}");
            }
        }
    }

    private async void HandleMatchResult(string name, string confidence, bool isMatch, bool hasImage)
    {
        
        Preferences.Set("hasimage", "scanned");
        if (hasImage)
        {
            var faceImageBase64 = await GetLastMatchImageAsync();
            if (!string.IsNullOrEmpty(faceImageBase64))
            {
                CapturedImageBase64 = faceImageBase64;
                string[] prefiximage = CapturedImageBase64.Split(',');
                if (prefiximage.Length > 1)
                {
                    Preferences.Set("liveUserImg", prefiximage[1]);
                }

                WasCaptured = isMatch;
            }
        }

        // Navigate back to the previous page
        MainThread.BeginInvokeOnMainThread(async () =>
        {
            await Navigation.PopAsync();
        });
    }

    public async Task<string?> GetLastMatchImageAsync()
    {
        try
        {
            var result = await webView.EvaluateJavaScriptAsync("getLastMatchImage()");
            return result;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[FaceApp] Error getting image: {ex.Message}");
            return null;
        }
    }
}