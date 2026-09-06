// ============================================================
// Google Apps Script — Run this at https://script.google.com
// 
// Ye script NEET + RANDOM dono sections ka data nikalegi
// Output ko directly libraryData.js mein paste kar dena
// ============================================================

function generateLibraryData() {

  // NEET PYQ folder IDs
  var neetFolders = {
    physics:   '1_FpkNbmhPhH2K05VTKq02i5ulp2f8ifv',
    chemistry: '1aB90Vy9c3ct18SQGs_eiyl4iuByciA9N',
    biology:   '15iJSObfgX8xpEEfo207tfeCc0_C-206q',
  };

  // Random folder IDs
  var randomFolders = {
    physics:   '1fRGcBBjS12anzdKuwjRU4eUxsg0vlYU9',
    chemistry: '19TLpwwelPH-cpRHcEJAEO4uLYio-ochx',
    biology:   '1iMQIKPpW_me4RlxgXpohcpMNNIKg9dzC',
  };

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

  output += 'const libraryData = { physics, chemistry, biology };\n\n';
  output += 'export default libraryData;\n';

  Logger.log(output);
}

function getFilesFromFolder(folderId) {
  try {
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
