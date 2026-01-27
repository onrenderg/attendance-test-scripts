#if ANDROID
using Android.Webkit;
#endif

namespace VectorP
{
    public partial class MainPage : ContentPage
    {
        public MainPage()
        {
            InitializeComponent();

            Microsoft.Maui.Handlers.WebViewHandler.Mapper.AppendToMapping("MyCustomization", (handler, view) =>
            {
#if ANDROID
                handler.PlatformView.Settings.JavaScriptEnabled = true;
                handler.PlatformView.Settings.AllowFileAccess = true;
                handler.PlatformView.Settings.AllowFileAccessFromFileURLs = true;
                handler.PlatformView.Settings.AllowUniversalAccessFromFileURLs = true;
                handler.PlatformView.Settings.MixedContentMode = MixedContentHandling.AlwaysAllow;
                handler.PlatformView.Settings.DomStorageEnabled = true;
                handler.PlatformView.Settings.DatabaseEnabled = true;
#endif
            });

            LoadWebView();
        }

        private void LoadWebView()
        {
#if ANDROID
            // Resources/Raw files are mapped to android_asset in MAUI
            webview_loaddata.Source = "file:///android_asset/index.html";
#else
            webview_loaddata.Source = "index.html";
#endif
        }
    }
}



