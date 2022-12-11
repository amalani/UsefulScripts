/*
Script that lets you use GoogleScript engine to delete emails older than x days in particular labels.

1. Go to script.google.com.
2. Create a new project.
3. Paste this script.
6. Run. 
7. View Logger - verify working as expected.
8. Set debug to false.


*/

var debug = true; // true/false -> true will only log to console, false will actually delete.

// These represent labels - for example the ".delete_7" label I want to delete emails older than 7 days.
// You can add as many such labels as you like. I've commented the last two as an example 
var filters = [
   ['.delete_7', 7]
  ,['.delete_30', 30]
  ,['.delete_60', 60]  
//   ,['.delete_90', 90]
//   ,['.delete_180', 180]
];


function purgeEmails(label, days, debug) {
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
          if (debug) {
            console.log(email.getFrom() + ": " + email.getSubject());
          }
          else {
            email.moveToTrash();
          }
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
  for (var filter = 0; filter < filters.length; filter++) {
    purgeEmails(filters[filter][0], filters[filter][1], debug);
  }
}
