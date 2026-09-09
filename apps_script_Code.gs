/*
BLACKOUT // GOOGLE APPS SCRIPT COLLECTOR

1) Create a Google Sheet.
2) Extensions -> Apps Script.
3) Paste this file.
4) Change ADMIN_TOKEN.
5) Deploy -> New deployment -> Web app.
   Execute as: Me
   Who has access: Anyone
6) Copy the Web App URL into config.js as SUBMIT_ENDPOINT.

The sheet will receive one row per submitted team.
The admin page reads results with ?action=list&token=YOUR_TOKEN.
*/
const ADMIN_TOKEN = "CAMBIA-QUESTO-TOKEN";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Risultati") ||
               SpreadsheetApp.getActiveSpreadsheet().insertSheet("Risultati");

    if (sh.getLastRow() === 0) {
      sh.appendRow([
        "timestamp","case_id","team","analyst1","analyst2","assigned_pcap",
        "suspect","how","proof","confidence","method_score","evidence_score",
        "technical_score","total_score"
      ]);
    }

    sh.appendRow([
      new Date(), data.case_id || "HX-047", data.team || "",
      data.analyst1 || "", data.analyst2 || "", data.assigned_pcap || "",
      data.suspect || "", data.how || "", data.proof || "",
      data.confidence || "", data.method_score || "", data.evidence_score || "",
      data.technical_score || "", data.total_score || ""
    ]);

    return json_({ok:true});
  } catch(err) {
    return json_({ok:false,error:String(err)});
  }
}

function doGet(e) {
  const action = (e.parameter.action || "").toLowerCase();
  const token = e.parameter.token || "";
  if (action !== "list" || token !== ADMIN_TOKEN) {
    return json_({ok:false,error:"unauthorized"});
  }

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Risultati");
  if (!sh || sh.getLastRow() < 2) return json_({ok:true,results:[]});

  const values = sh.getDataRange().getValues();
  const headers = values.shift();
  const results = values.map(row => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = row[i]);
    return obj;
  });
  return json_({ok:true,results});
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
