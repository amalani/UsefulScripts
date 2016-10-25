var EMAIL = "";
var GMAIL_LABEL = "";
var PURGE_AFTER = "30";

# Search filter to retrieve threads.
var search_filter = "in:label_to_delete"
# Once you have the threads, I only wanted to delete emails sent by the following person. 
var filter1 = { from: 'donotreply@us.gov' }

// --- Copy below this line into script ---

function Email(email_subject, email_body) {
    var message = {
        to: EMAIL,
        subject: "GmailPurge: " + email_subject,
        htmlBody: email_body,
    }
    MailApp.sendEmail(message);
}

function purgeGmail() {
    var age = new Date();
    age.setDate(age.getDate() - PURGE_AFTER);

    var purge_date  = Utilities.formatDate(age, Session.getScriptTimeZone(), "yyyy-MM-dd");
    var search = search_filter + ' before:' + purge_date;

    try {
        var threads = GmailApp.search(search, 0, 20);
        var count = 0;

        var body = ['Emails deleted:'];
        for (var i = 0; i < threads.length; i++) {
            var messages = GmailApp.getMessagesForThread(threads[i]);
            for (var j = 0; j < messages.length; j++) {
                var message = messages[j];

                if (message.getFrom().indexOf(filter1.from) != -1) {
                    body.push("ThreadSubject: " + threads[i].getFirstMessageSubject());
                    body.push("From: " + message.getFrom())
                    body.push("Date: " + message.getDate());
                    body.push("To: " + message.getTo())
                    body.push("");

                    message.moveToTrash();
                    count++;
                }
            }
        }

        var subject = 'Deleted ' + count + ' emails.';
        Email(subject, body.join('<br>'));
    }
    catch (e) {
        Email('Error', e.message)
    }
}

