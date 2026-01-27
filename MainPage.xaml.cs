namespace VectorP
{
    public partial class MainPage : ContentPage
    {
        public MainPage()
        {
            InitializeComponent();
            InitializeWebView();
        }

        private async void InitializeWebView()
        {
#if ANDROID
            // On Android, copy HTML to a location accessible by WebView and load from file URL
            var fileName = "index.html";
            var targetPath = Path.Combine(FileSystem.CacheDirectory, fileName);
            
            // Copy HTML from app package to cache directory
            using (var stream = await FileSystem.OpenAppPackageFileAsync(fileName))
            using (var fileStream = File.Create(targetPath))
            {
                await stream.CopyToAsync(fileStream);
            }
            
            // Load from file:// URL which allows proper fetch() origin
            webview_loaddata.Source = new UrlWebViewSource { Url = $"file://{targetPath}" };
#else
            // For other platforms, load inline HTML
            string htmlContent = await LoadHtmlFromRawAsync();
            webview_loaddata.Source = new HtmlWebViewSource { Html = htmlContent };
#endif
        }

        private async Task<string> LoadHtmlFromRawAsync()
        {
            using var stream = await FileSystem.OpenAppPackageFileAsync("index.html");
            using var reader = new StreamReader(stream);
            return await reader.ReadToEndAsync();
        }
    }
}
