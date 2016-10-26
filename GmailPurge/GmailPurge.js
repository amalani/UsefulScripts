/*
Script that lets you use GoogleScript engine to filter for emails and delete
specific emails.
1. Go to script.google.com.
2. Provide authorization to access your Google a/c.
3. Create a new project.
4. Paste this script.
5. Update the variables at the start of the script.
6. Run. 
*/

// Where to send notifications
var EMAIL = "";
// Delay - skip the most recent x days of emails. Use 0 to not skip anything.
var PURGE_AFTER = 30;

// Search filter to retrieve threads.
var search_filter = "label:label_to_delete"
// Once you have the threads, I only wanted to delete emails sent by the following person. 
var filter1 = { from: 'donotreply@us.gov' }

// --- do not change below this ---

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
    var search = search_filter;
    
    if (PURGE_AFTER > 0) {
        var age = new Date();
        age.setDate(age.getDate() - PURGE_AFTER);
        var purge_date  = Utilities.formatDate(age, Session.getScriptTimeZone(), "yyyy-MM-dd");
        search += ' before:' + purge_date;
    }

    var body = [];
    var count = 0;
  
    try {
        body.push('Emails deleted: ');
        // add the delay by uncommenting the line
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
