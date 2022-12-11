var filters = [
   ['.delete_7', 7]
  ,['.delete_30', 30]
  ,['.delete_60', 60]  
//   ,['.delete_90', 90]
//   ,['.delete_180', 180]
];


function purgeEmails(label, days) {
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days)

  var dtString  = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), "yyyy-MM-dd");
  var filter = "label:" + label + " before:" + dtString;

  // console.log(filter);

  var count = 0;
  try {
    var threads = GmailApp.search(filter, 0, 100);
      for (var thread = 0; thread < threads.length; thread++) {
      var messages = GmailApp.getMessagesForThread(threads[thread]);
      for (var message = 0; message < messages.length; message++) {
        var email = messages[message];       
        if (email.getDate() < cutoff) {
          // console.log(email.getFrom() + ": " + email.getSubject());
          email.moveToTrash();
          count++;
        }
      }
    }
  } catch (e) {
    console.log(e);
  }

  console.log("Deleted " + count + " messages for [" + label + "]");
}

function clearEmails() {
  console.log("Start")
  for (var i = 0; i < filters.length; i++) {
    purgeEmails(filters[i][0], filters[i][1]);
  }
}
