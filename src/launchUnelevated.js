var objShell = new ActiveXObject("shell.application");
var objShellWindows = objShell.Windows();
if (objShellWindows != null)
{
    var fso = new ActiveXObject("Scripting.FileSystemObject");
    var tempFile = WScript.Arguments(0);
    var file = fso.OpenTextFile(tempFile, 2, true, 0);
    file.WriteLine("");
    file.Close();

    // Build up the parameters for launching the application and getting the process id
    var command = "cmd";
    var params = "/c \"wmic /OUTPUT:" + tempFile + " process call create \"";
    for (var i = 1; i < WScript.Arguments.length; i++) {
        params += WScript.Arguments(i) + " ";
    }
    params += "\"\"";

    for (var i = 0; i < objShellWindows.count; i++)
    {
        var item = objShellWindows.Item(i);
        if (item)
        {
            item.Document.Application.ShellExecute(command, params);
            break;
        }
    }
}