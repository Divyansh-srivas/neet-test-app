// ============================================================
// Google Apps Script — Run this at https://script.google.com
// 
// Ye script NEET + RANDOM dono sections ka data nikalegi
// Output ko directly libraryData.js mein paste kar dena
// ============================================================

function generateLibraryData() {

  // NEET PYQ folder IDs
  var neetFolders = {
    physics:   'https://drive.google.com/drive/folders/1_FpkNbmhPhH2K05VTKq02i5ulp2f8ifv',
    chemistry: 'https://drive.google.com/drive/folders/1aB90Vy9c3ct18SQGs_eiyl4iuByciA9N',
    biology:   'https://drive.google.com/drive/folders/15iJSObfgX8xpEEfo207tfeCcO_C-206q',
  };

  // Random folder IDs
  var randomFolders = {
    physics:   'https://drive.google.com/drive/folders/1fRGcBBjS12anzdKuwjRU4eUxsg0vlYU9',
    chemistry: 'https://drive.google.com/drive/folders/19TLpwweIPH-cpRHcEJAEO4uLYio-ochx',
    biology:   'https://drive.google.com/drive/folders/1iMQIKPpW_me4RIxgXpohcpMNNIKg9dzC',
  };

  // Auto-generate JS code
  var output = '// Auto-generated from Google Drive\n\n';
  var subjects = ['physics', 'chemistry', 'biology'];

  for (var s = 0; s < subjects.length; s++) {
    var subjectName = subjects[s];
    output += 'const ' + subjectName + ' = {\n';

    // NEET section
    output += '  neet: [\n';
    output += getFilesFromFolder(neetFolders[subjectName]);
    output += '  ],\n';

    // JEE section (empty for now)
    output += '  jee: [\n    // JEE chapters — add later\n  ],\n';

    // Random section
    output += '  random: [\n';
    output += getFilesFromFolder(randomFolders[subjectName]);
    output += '  ],\n';

    output += '};\n\n';
  }

  output += 'const libraryData = { physics, chemistry, biology };\n\nexport default libraryData;\n';

  // Save to Google Drive to avoid truncation
  var file = DriveApp.createFile('libraryData_output.js', output, MimeType.PLAIN_TEXT);
  console.log('✅ Success! Output saved to a file in your Google Drive named "libraryData_output.js"');
  console.log('🔗 Link to open file: ' + file.getUrl());
}

function getFilesFromFolder(folderIdOrUrl) {
  try {
    // Extract ID if a full URL is provided
    var folderId = folderIdOrUrl;
    if (folderId.indexOf('http') === 0) {
      var match = folderId.match(/folders\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        folderId = match[1];
      }
    }
    
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var fileList = [];

    while (files.hasNext()) {
      var file = files.next();
      var name = file.getName()
        .replace(/\.pdf$/i, '')
        .replace(/_merged/gi, '').replace(/merged/gi, '').replace(/marged/gi, '')
        .replace(/\s*\(\d+\)/g, '')
        .replace(/nw_/gi, '').replace(/nw /gi, '')
        .replace(/Mb$/gi, '')
        .replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

      name = name.split(' ').map(function(word) {
        if (word.length === 0) return '';
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ');

      fileList.push({ name: name, link: file.getUrl() });
    }

    fileList.sort(function(a, b) { return a.name.localeCompare(b.name); });

    var result = '';
    for (var i = 0; i < fileList.length; i++) {
      result += "    { chapter_name: '" + fileList[i].name.replace(/'/g, "\\'") + "', pdf_link: '" + fileList[i].link + "' },\n";
    }
    return result;

  } catch (e) {
    return '    // ERROR: ' + e.message + '\n';
  }
}
