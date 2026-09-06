// ============================================================
// Google Apps Script — Run this at https://script.google.com
// 
// YE SCRIPT SEEDHA COPY-PASTE READY CODE GENERATE KARTI HAI!
// Output ko directly libraryData.js mein paste kar dena.
// ============================================================

function generateLibraryData() {

  // ⬇️ YAHAN APNE FOLDER IDs DAALO (URL bar se copy karo) ⬇️
  var folders = {
    physics:   '1fRGc8BjS12anzdKuwjRU4eUxsg0vlYU9',   // Physics folder ID
    chemistry: 'YAHAN_CHEMISTRY_FOLDER_ID_DAALO',       // Chemistry folder ID
    biology:   'YAHAN_BIOLOGY_FOLDER_ID_DAALO',          // Biology folder ID
  };

  var output = '// Auto-generated from Google Drive\n\n';

  var subjects = Object.keys(folders);

  for (var s = 0; s < subjects.length; s++) {
    var subjectName = subjects[s];
    var folderId = folders[subjectName];

    // Skip placeholder IDs
    if (folderId.indexOf('YAHAN') === 0) {
      output += 'const ' + subjectName + ' = [\n  // TODO: Add ' + subjectName + ' folder ID and re-run\n];\n\n';
      continue;
    }

    try {
      var folder = DriveApp.getFolderById(folderId);
      var files = folder.getFiles();
      var fileList = [];

      while (files.hasNext()) {
        var file = files.next();
        var name = file.getName();

        // Clean up name
        name = name
          .replace(/\.pdf$/i, '')
          .replace(/_merged/gi, '')
          .replace(/merged/gi, '')
          .replace(/marged/gi, '')
          .replace(/\s*\(\d+\)/g, '')
          .replace(/nw_/gi, '')
          .replace(/nw /gi, '')
          .replace(/Mb$/gi, '')
          .replace(/_/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Title Case
        name = name.split(' ').map(function(word) {
          if (word.length === 0) return '';
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');

        fileList.push({
          name: name,
          link: file.getUrl()
        });
      }

      // Sort alphabetically
      fileList.sort(function(a, b) { return a.name.localeCompare(b.name); });

      // Generate JS code
      output += 'const ' + subjectName + ' = [\n';
      for (var i = 0; i < fileList.length; i++) {
        output += "  { chapter_name: '" + fileList[i].name.replace(/'/g, "\\'") + "', pdf_link: '" + fileList[i].link + "' },\n";
      }
      output += '];\n\n';

    } catch (e) {
      output += 'const ' + subjectName + ' = [\n  // ERROR: Could not access folder. Check ID and permissions.\n];\n\n';
    }
  }

  output += 'const libraryData = { physics, chemistry, biology };\n\n';
  output += 'export default libraryData;\n';

  Logger.log(output);
}
