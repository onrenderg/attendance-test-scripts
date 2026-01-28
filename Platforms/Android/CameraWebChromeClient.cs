using Android.Webkit;

namespace VectorP;

/// <summary>
/// Custom WebChromeClient that handles camera permission requests from JavaScript
/// Required for navigator.mediaDevices.getUserMedia() to work in WebView
/// </summary>
public class CameraWebChromeClient : WebChromeClient
{
    /// <summary>
    /// Handle permission requests from web content (camera, microphone, etc.)
    /// </summary>
    public override void OnPermissionRequest(PermissionRequest? request)
    {
        if (request == null) return;

        // Get requested resources
        var resources = request.GetResources();
        
        if (resources != null)
        {
            // Auto-grant camera permission for our trusted local HTML
            request.Grant(resources);
        }
        else
        {
            base.OnPermissionRequest(request);
        }
    }

    public override bool OnConsoleMessage(ConsoleMessage? consoleMessage)
    {
        if (consoleMessage != null)
        {
            System.Diagnostics.Debug.WriteLine($"[WebView Console] {consoleMessage.Message()}");
        }
        return base.OnConsoleMessage(consoleMessage);
    }
}
