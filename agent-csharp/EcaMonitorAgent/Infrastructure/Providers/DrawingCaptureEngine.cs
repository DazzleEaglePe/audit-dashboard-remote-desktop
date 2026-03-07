using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using EcaMonitorAgent.Domain.Interfaces;

namespace EcaMonitorAgent.Infrastructure.Providers;

public class DrawingCaptureEngine : IScreenCaptureEngine
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetDesktopWindow();

    [DllImport("user32.dll")]
    private static extern IntPtr GetWindowDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    private static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    private static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    private static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hdcSrc, int nXSrc, int nYSrc, int dwRop);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    private static extern bool DeleteObject(IntPtr hObject);

    [DllImport("user32.dll")]
    private static extern int GetSystemMetrics(int nIndex);

    private const int SM_CXSCREEN = 0;
    private const int SM_CYSCREEN = 1;
    private const int SRCCOPY = 0x00CC0020;

    public string? CaptureSessionAsBase64(int sessionId, int width, int height, int quality)
    {
        // For a C# app running inside the user's session (as scheduled task on logon),
        // we can simply copy from the current screen without needing CreateProcessAsUser.

        try
        {
            int screenWidth = GetSystemMetrics(SM_CXSCREEN);
            int screenHeight = GetSystemMetrics(SM_CYSCREEN);

            if (screenWidth == 0 || screenHeight == 0) return null;

            IntPtr hDesk = GetDesktopWindow();
            IntPtr hSrce = GetWindowDC(hDesk);
            IntPtr hDest = CreateCompatibleDC(hSrce);
            IntPtr hBmp = CreateCompatibleBitmap(hSrce, screenWidth, screenHeight);
            IntPtr hOldBmp = SelectObject(hDest, hBmp);

            BitBlt(hDest, 0, 0, screenWidth, screenHeight, hSrce, 0, 0, SRCCOPY);

            SelectObject(hDest, hOldBmp);
            DeleteDC(hDest);
            ReleaseDC(hDesk, hSrce);

            using var img = Image.FromHbitmap(hBmp);
            DeleteObject(hBmp);

            // Resize
            using var resized = new Bitmap(img, new Size(width, height));
            
            // Compress
            using var ms = new MemoryStream();
            var encoderParams = new EncoderParameters(1);
            encoderParams.Param[0] = new EncoderParameter(Encoder.Quality, quality);
            var jpegCodec = GetEncoderInfo("image/jpeg");

            resized.Save(ms, jpegCodec!, encoderParams);

            return Convert.ToBase64String(ms.ToArray());
        }
        catch
        {
            return null;
        }
    }

    private static ImageCodecInfo? GetEncoderInfo(string mimeType)
    {
        return ImageCodecInfo.GetImageEncoders().FirstOrDefault(t => t.MimeType == mimeType);
    }
}
