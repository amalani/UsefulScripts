var EMAIL = "";
var GMAIL_LABEL = "";
var PURGE_AFTER = "30";

# Search filter to retrieve threads.
var search_filter = "label:label_to_delete"
# Once you have the threads, I only wanted to delete emails sent by the following person. 
var filter1 = { from: 'donotreply@us.gov' }

// --- Copy below this line into script ---

function Email(email_subject, body) {
    body.push("<br><br>" + MailApp.getRemainingDailyQuota() + " more emails can be sent today.");
    var message = {
        to: EMAIL,
        subject: "[gscript][GmailPurge]: " + email_subject,
        htmlBody: body.join('<br>'),
    }
    MailApp.sendEmail(message);
}

function purgeGmail() {
    var age = new Date();
    age.setDate(age.getDate() - PURGE_AFTER);

    var purge_date  = Utilities.formatDate(age, Session.getScriptTimeZone(), "yyyy-MM-dd");

    var body = [];
    var count = 0;
  
    try {
        body.push('Emails deleted: ');
        var search = search_filter; // + ' before:' + purge_date;
        var threads = GmailApp.search(search, 0, 50);
       
        for (var i = 0; i < threads.length; i++) {
            var messages = GmailApp.getMessagesForThread(threads[i]);
            var threadSubject = threads[i].getFirstMessageSubject();
            var threadId = threads[i].getId();
            for (var j = 0; j < messages.length; j++) {
                var message = messages[j];
                var from = message.getFrom()
                if (from.indexOf(filter1.from) != -1) {
                    var threadTitle = 'Thread (' + threadId + '): ' + threadSubject;
                        body.push(threadTitle);
                        body.push("From: " + from)
                        body.push("Date: " + message.getDate());
                        body.push("To: " + message.getTo())
                        body.push("");

                        message.moveToTrash();
                        count++;
                }
            }
        }
    }
    catch (e) {
        body.push('Exception: ' + e.message);
    }
  
    var subject = 'Deleted ' + count + ' emails.';
    Email(subject, body);  
}
