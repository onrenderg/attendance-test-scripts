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
            // Resources/Raw/wwwroot files are mapped to android_asset/wwwroot in MAUI
            webview_loaddata.Source = "file:///android_asset/wwwroot/index.html";
#else
            webview_loaddata.Source = "wwwroot/index.html";
#endif
        }
    }
}



