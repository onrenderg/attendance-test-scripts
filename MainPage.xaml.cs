namespace VectorP
{
    public partial class MainPage : ContentPage
    {
        public MainPage()
        {
            InitializeComponent();
            LoadWebView();
        }

        private void LoadWebView()
        {
#if ANDROID
            // Resources/Raw files are mapped to android_asset in MAUI
            webview_loaddata.Source = "file:///android_asset/wwwroot/index.html";
#else
            webview_loaddata.Source = "index.html";
#endif
        }
    }
}



