/*
Script that lets you use GoogleScript engine to filter for emails and delete
specific emails.
1. Go to script.google.com.
2. Provide authorization to access your Google a/c.
3. Create a new project.
4. Paste this script.
5. Update the settings block at the start of the script.
6. Run. 
7. View Logger - verify working as expected.
8. Turn off the debug flag.
*/

var settings = {
    notificationsAddr: "<your email address>",
    olderThan: 20,                              // only touch emails older than these many days.
    searchFilter: "label:label_to_search",      // search filter to use to look up emails (where all your CRs go)
    filter1: { from: 'donotreply@us.gov' },     // only delete emails that match this filter. 
    debug: true,                                // No changes, log only.
}

// -- Do not touch code below this.

function GmailPurge(settings) {
    this.settings = settings;
}

GmailPurge.prototype = {
    constructor: GmailPurge,

    notify: function(subject, body) {
        body.push("<br><br>" + MailApp.getRemainingDailyQuota() + " more emails can be sent today.");
        bodyText = body.join('<br>');
        var message = {
            to: this.settings.notificationsAddr,
            subject: "[gscript][GmailPurge]: " + subject,
            htmlBody: bodyText,
        }
        if (this.settings.debug) {
            Logger.log(subject);
            for (var i = 0; i < body.length; i++) {
                Logger.log(body[i]);
            }
        } else {
            MailApp.sendEmail(message);
        }
    },

    getThreadFilter: function() {
        var filter = this.settings.searchFilter;
        if (this.settings.olderThan > 0) {
            var d = new Date();
            d.setDate(d.getDate() - this.settings.olderThan);
            var delay = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            filter += " before:" + delay;
        }
        return filter;
    },

    getThreads: function() {
        return GmailApp.search(this.getThreadFilter(), 0, 20);
    },

    run: function() {
        var body = [];
        var stats = { threads: 0, processed: 0 }

        try {
            body.push('Emails deleted:');

            var threads = this.getThreads();
            stats.threads = threads.length;

            for (var t = 0; t < threads.length; t++) {
                var thread = threads[t];
                var threadId = thread.getId();
                var threadSubject = thread.getFirstMessageSubject();
                var messages = GmailApp.getMessagesForThread(thread);

                for (var m = 0; m < messages.length; m++) {
                    var message = messages[m];
                    var from = message.getFrom();
                    if (from.indexOf(this.settings.filter1.from) != -1) {
                        body.push(
                            'Thread (' + threadId + '): ' + threadSubject,
                            'From: ' + from,
                            'Date: ' + message.getDate(),
                            'To: ' + message.getTo(),
                            ''
                        )

                        if (!this.settings.debug) {
                            message.moveToTrash();
                        }
                        stats.processed++;
                    }
                }
            }
        }
        catch (ex) {
            body.push('Exception: ' + ex.message);
        }

        var subject = 'Deleted ' + stats.processed + ' emails from ' + stats.threads + ' threads.';
        this.notify(subject, body);
    }
};

var purger = new GmailPurge(settings);
purger.run();