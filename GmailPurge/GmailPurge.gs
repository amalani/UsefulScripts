var GMAIL_LABEL = "Newsletters";
var PURGE_AFTER = "30";



function Intialize() {
  return;
}

function Install() {

  ScriptApp.newTrigger("purgeGmail")
           .timeBased()
           .at(new Date((new Date()).getTime() + 1000*60*2))
           .create();
  
  ScriptApp.newTrigger("purgeGmail")
           .timeBased().everyDays(1).create();

}

function Uninstall() {
  
  var triggers = ScriptApp.getScriptTriggers();
  for (var i=0; i<triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  
}

function purgeGmail() {
  
  var age = new Date();  
  age.setDate(age.getDate() - PURGE_AFTER);    
  
  var purge  = Utilities.formatDate(age, Session.getScriptTimeZone(), "yyyy-MM-dd");
  var search = "label:" + GMAIL_LABEL + " before:" + purge;
  
  try {
    
    var threads = GmailApp.search(search, 0, 100);
    
    if (threads.length == 100) {
      ScriptApp.newTrigger("purgeGmail")
               .timeBased()
               .at(new Date((new Date()).getTime() + 1000*60*10))
               .create();
    }
    
    for (var i=0; i<threads.length; i++) {
      var messages = GmailApp.getMessagesForThread(threads[i]);
      for (var j=0; j<messages.length; j++) {
        var email = messages[j];       
        if (email.getDate() < age) {
            # email.moveToTrash();

        }
      }
    }
    
  } catch (e) {}
}



/* Gmail purge - original from http://labnol.org/?p=27605, modified */
/*
  For details, refer http://labnol.org/?p=27605
  T U T O R I A L
  - - - - - - - - 
  Step 1. Update the values of fields GMAIL_LABEL and PURGE_AFTER above.
  Step 2. Go to Run -> Initialize and authorize the script.
  Step 3. Go to Run -> Install to install the script.

  You can now exit this window and any email messages in Gmail folder will automatically 
  get purged after 'n' days. The script will run by itself everyday at 01:00 hours.
  Also, you may go to Run -> Uninstall to stop the purging script anytime.
*/
