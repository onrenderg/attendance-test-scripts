using Microsoft.Extensions.Logging;
#if ANDROID
using Android.Webkit;
#endif

namespace VectorP
{
    public static class MauiProgram
    {
        public static MauiApp CreateMauiApp()
        {
            var builder = MauiApp.CreateBuilder();
            builder
                .UseMauiApp<App>()
                .ConfigureFonts(fonts =>
                {
                    fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                    fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
                });

#if ANDROID
            // Configure WebView for local file loading (matching HppscAttendance setup)
            Microsoft.Maui.Handlers.WebViewHandler.Mapper.AppendToMapping("WebViewConfig", (handler, view) =>
            {
                var webView = handler.PlatformView;
                webView.Settings.JavaScriptEnabled = true;
                webView.Settings.AllowFileAccess = true;
                webView.Settings.AllowContentAccess = true;
                webView.Settings.DomStorageEnabled = true;
                webView.Settings.MixedContentMode = MixedContentHandling.AlwaysAllow;
                webView.Settings.AllowFileAccessFromFileURLs = true;
                webView.Settings.AllowUniversalAccessFromFileURLs = true;
            });
#endif

#if DEBUG
            builder.Services.AddLogging(configure =>
            {
                configure.AddDebug();
            });
#endif

            return builder.Build();
        }
    }
}
