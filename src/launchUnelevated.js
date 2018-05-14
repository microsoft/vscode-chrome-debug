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
    var params = "/c \"wmic /OUTPUT:\"" + tempFile + "\" process call create \"";
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

    if (objShellWindows.count === 0) {
        // If no File Explorer windows are open fall-back to this alternative way of executing the command
        // See IShellWindows::FindWindowSW at https://msdn.microsoft.com/en-us/library/windows/desktop/cc836568(v=vs.85).aspx
        var item = objShellWindows.FindWindowSW(/*pvarLoc=NULL*/0, /*pvarLocRoot=NULL*/0, /*SWC_DESKTOP*/8, /*phwnd=NULL*/0, /*SWFO_NEEDDISPATCH*/1);
        item.Document.Application.ShellExecute(command, params);
    }
}