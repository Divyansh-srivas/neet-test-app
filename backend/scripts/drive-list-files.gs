// ============================================================
// Google Apps Script — Run this at https://script.google.com
// This will print all file names & links from a Google Drive folder.
// ============================================================

function listFiles() {
  // CHANGE THIS to your folder ID (from the URL bar when you open the folder)
  var FOLDER_ID = '1fRGc8BjS12anzdKuwjRU4eUxsg0vlYU9';  // Physics folder

  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFiles();
  var result = [];

  while (files.hasNext()) {
    var file = files.next();
    result.push({
      name: file.getName(),
      link: file.getUrl()
    });
  }

  // Sort alphabetically
  result.sort(function(a, b) { return a.name.localeCompare(b.name); });

  // Print — you'll see this in the Execution Log
  Logger.log(JSON.stringify(result, null, 2));
}
