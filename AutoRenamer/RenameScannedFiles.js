/*
Auto file renamer - Ever had a bunch of files that were named the same but you wanted to rename 
them sequentially? Whenever I scan some documents, the scanner scans and sends them to be via 
email but the file name has the same attachement. If I want to download all those files to a 
single folder, I need to drop a file in the folder and rename it before I can drop another one
due to the same file name. This becomes rather tedious if there are multiple documents.

So here's a script to do that automatically. Just drop any file with a filename in the renameList
array in the folder where you started this script and it will rename it to a sequential order.
While the script is executing, it will add a continue.txt file in the folder, so make sure you
execute the script again to stop the loop (and remove continue.txt).

Really though, it's just a script that runs in a loop once you start it (with a 1500ms interval)
and continues doing your task until you execute the script again. So you can customize it to anything else.

	to execute on windows, 
		cscript RenameScannedFiles.js or 
		wscript RenameScannedFiles.js

TODO: 
1. handle different file extensions
2. Refactor working code outside and pass as anonymous/lambda function to help reusability.
*/

// WScript common code
var console = {
    log: function (s) { WScript.Echo(s); },
    debug: function (s) { if (this.isDebugging) this.log(s); },
    isDebugging: false
};
function alert(s) { console.log(s); }

var context = {
    scriptFileName: String(WScript.ScriptName).toLowerCase(),
    scriptFolder: WScript.ScriptFullName.replace(WScript.ScriptName, ''), // has trailing slash
    arguments: [],
    loadArguments: function () {
        for (var i = 0; count = WScript.Arguments.Count(), i < count; i++) {
            context.arguments.push(WScript.Arguments.item(i))
        }
    }
};
context.loadArguments();

// Common helpers
// Finds an item in an array.
if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (s) {
        for (var i = 0; i < this.length; i++) {
            if (this[i].indexOf(s) > -1) return i;
        }
        return -1;
    }
}

if (!String.prototype.trim) {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/trim
    String.prototype.trim = function () {
        return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    };
}

// Start script
function ScannedFileRenamer() {
    this.fso = new ActiveXObject("Scripting.FileSystemObject");
    this.folder = this.fso.getFolder(".");
    this.nextFileNumber = 1;
    this.renameList = [
        'Scanned from a Digital Campus Public Print Supported Device.pdf'
    ];
}

ScannedFileRenamer.prototype = {
    constructor: ScannedFileRenamer,

    run: function () {
        var stop = this.startOrStopLoop();

        if (!stop) {
            this.getLastFile();

            this.runLoop();
        }
    },

    getLastFile : function() {
        var id = 1;

        for (var i = 1; i < 200; i++) {
            try  {
                var file = this.fso.getFile(i + '.pdf');
            }
            catch (ex) {

                this.nextFileNumber = i;
                break;
            }
        }
    },

    runLoop : function() {
        var foundFile = true;

        while (foundFile) {
            var didAction = false;
            for (var i = 0 ; i < this.renameList.length; i++) {
                try {
                    var file = this.fso.getFile(this.renameList[i])
                    file.move(this.nextFileNumber + '.pdf');

                    console.log("Renamed '" + this.renameList[i] + "' -> '" + this.nextFileNumber + ".pdf'");
                    this.nextFileNumber++;
                    didAction = true;
                }
                catch (ex) {
                    // console.log(ex.message);
                }
            }

            if (!didAction) {
                console.log('Looking for matching files...');
            }

            WScript.Sleep(1500);
            foundFile = this.shouldContinue();
        }

    },

    shouldContinue : function() {
        try {
            var file = this.fso.getFile('continue.txt');
            return true;
        }
        catch (ex) {
            return false;
        }
    },

    startOrStopLoop: function () {
        try {
            var file = this.fso.getFile('continue.txt');
            // Found - delete.
            file.Delete();
            return true; // stop loop
        }
        catch (ex) {
            // not found, create file which will start the loop.
        }

        var file = this.fso.createTextFile('continue.txt', true);
        file.close();
        return false;
    }
}

var foo = new ScannedFileRenamer();
foo.run();
