param(
  [int]$Port = 8000
)

<#
  Node.js が入っていないWindows環境向けのローカル確認サーバーです。

  使い方:
    powershell -ExecutionPolicy Bypass -File .\tools\local-server.ps1 8000

  止め方:
    この画面で Ctrl + C

  メモ:
  - content/site.def をブラウザから読み込むため、HTMLを直接開くのではなく
    http://127.0.0.1:8000/ で確認します。
  - このスクリプトは tools フォルダの1つ上をサイトのルートとして配信します。
#>

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

# PowerShellだけで長いHTTP処理を書くと初心者には読みにくいため、
# 小さなC#クラスをその場で読み込み、静的ファイルだけを配信します。
$Source = @"
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;

public static class LocalStaticServer
{
    public static void Run(string root, int port)
    {
        string rootFull = Path.GetFullPath(root);
        string rootWithSlash = rootFull.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;

        var types = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { ".html", "text/html; charset=utf-8" },
            { ".css", "text/css; charset=utf-8" },
            { ".js", "text/javascript; charset=utf-8" },
            { ".def", "text/plain; charset=utf-8" },
            { ".md", "text/plain; charset=utf-8" },
            { ".png", "image/png" },
            { ".jpg", "image/jpeg" },
            { ".jpeg", "image/jpeg" },
            { ".svg", "image/svg+xml" },
            { ".webp", "image/webp" }
        };

        var listener = new TcpListener(IPAddress.Parse("127.0.0.1"), port);
        listener.Start();

        Console.WriteLine("Local server: http://127.0.0.1:" + port + "/");
        Console.WriteLine("Stop: Ctrl + C");

        while (true)
        {
            using (var client = listener.AcceptTcpClient())
            using (var stream = client.GetStream())
            {
                var reader = new StreamReader(stream, Encoding.ASCII, false, 1024, true);
                string requestLine = reader.ReadLine();
                if (string.IsNullOrWhiteSpace(requestLine)) continue;

                string headerLine;
                while (!string.IsNullOrEmpty(headerLine = reader.ReadLine())) { }

                string[] parts = requestLine.Split(' ');
                string method = parts.Length > 0 ? parts[0] : "GET";
                string target = parts.Length > 1 ? parts[1] : "/";

                if (method != "GET")
                {
                    SendText(stream, 405, "Method not allowed");
                    continue;
                }

                string pathOnly = target.Split('?')[0];
                string requestPath = Uri.UnescapeDataString(pathOnly);
                if (requestPath == "/") requestPath = "/index.html";

                string relative = requestPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                string file = Path.GetFullPath(Path.Combine(rootFull, relative));

                // ルート外のファイルを読まないための安全チェックです。
                if (!file.StartsWith(rootWithSlash, StringComparison.OrdinalIgnoreCase))
                {
                    SendText(stream, 403, "Forbidden");
                    continue;
                }

                if (!File.Exists(file))
                {
                    SendText(stream, 404, "Not found");
                    continue;
                }

                string ext = Path.GetExtension(file);
                string contentType;
                if (!types.TryGetValue(ext, out contentType))
                {
                    contentType = "application/octet-stream";
                }

                byte[] body = File.ReadAllBytes(file);
                Send(stream, 200, "OK", contentType, body);
            }
        }
    }

    private static void SendText(NetworkStream stream, int statusCode, string text)
    {
        byte[] body = Encoding.UTF8.GetBytes(text);
        string reason = statusCode == 403 ? "Forbidden" :
            statusCode == 404 ? "Not Found" :
            statusCode == 405 ? "Method Not Allowed" :
            "OK";

        Send(stream, statusCode, reason, "text/plain; charset=utf-8", body);
    }

    private static void Send(NetworkStream stream, int statusCode, string reason, string contentType, byte[] body)
    {
        string header =
            "HTTP/1.1 " + statusCode + " " + reason + "\r\n" +
            "Content-Type: " + contentType + "\r\n" +
            "Content-Length: " + body.Length + "\r\n" +
            "Cache-Control: no-store\r\n" +
            "Connection: close\r\n" +
            "\r\n";

        byte[] headerBytes = Encoding.ASCII.GetBytes(header);
        stream.Write(headerBytes, 0, headerBytes.Length);
        stream.Write(body, 0, body.Length);
    }
}
"@

Add-Type -TypeDefinition $Source
[LocalStaticServer]::Run($Root, $Port)
