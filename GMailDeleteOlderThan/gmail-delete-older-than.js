/*
Script that lets you use GoogleScript engine to delete emails older than x days in particular labels.

The way it would work is you use gmail filters to auto tag emails with certain labels (I use .dXX but you can use any). 
Then I filter promotional emails and set them to auto label 30 days, or some emails I want to keep longer - I put them in the 90 day label.
Then update the filters array below to match your label names and cut off date. The script will run and keep the last x days of emails but delete the rest.
Due to run time limits, I only deleted 100 emails per label per run - so if you have more, you may need to run it more often (you can set the trigger to every few hours or every day and it will keep doing its work in the background) 

Original at: https://github.com/amalani/UsefulScripts/blob/master/GMailDeleteOlderThan/gmail-delete-older-than.js

--- 

1. Go to script.google.com.
2. Create a new project.
3. Paste this script.
4. Update the filters below.
5. Run - Press the play button in the top nav (ensure the method name in the drop down next to it is clearEmails() and not purgeEmails())
    - On first run - you'll get asked permission to allow access to your gmail account.
6. View Logger - verify working as expected.
7. Set debug to false.


// Later once you've verified this works as you'd like.

9. Go to the trigger tab (see alarm icon in left navigation) - set it to run every few hours or every day etc.

Note: Just be careful when you setup the filters so that emails get auto-labeled as these will get deleted behind the scenes. Sometimes, companies use the same "from" address when sending promotional emails as well as transactional emails that you may not want to accidentally delete.

10. If you'd like to receive a summary email with the subjects of all the emails that were deleted, add an email address to the notificationsAddr field. 

*/

var config = {
  // true/false -> true will only log to console, false will actually delete.
  debug: false,

  // These represent labels and the days you want to keep them - for instance, anything I want to keep only the most recent 7 days' emails, I label them with the .d7 label on row 1.
  // You can add as many such label/day combos as you like. I've commented the last two as an example.
  filters: [
     ['.d7', 7]
    ,['.d30', 30]
    ,['.d60', 60]  
    // ,['.d90', 90]
    // ,['.d180', 180]
  ],

  notificationsAddr: '', // # Set to '' to not send emails.
};

class GmailDeleteOlderThan {
  constructor(config) {
    this.config = config;
  }

  notify(subject, body, notificationsAddr) {
    // body.push("<br><br>" + MailApp.getRemainingDailyQuota() + " more emails can be sent today.");

    if (this.config.debug) {
      body.push("[DEBUG] Emails won't be deleted.")
      console.log("[DEBUG] Email sent to: " + subject);
    }
    var message = {
        to: notificationsAddr,
        subject: "[gscript][Gmail-Delete-Older-Than]: " + subject,
        htmlBody: body.join('<br>'),
    }
    MailApp.sendEmail(message);
  }

  purgeEmails(label, days, debug) {
    var cutOff = new Date();
    cutOff.setDate(cutOff.getDate() - days);

    var dtString = Utilities.formatDate(cutOff, Session.getScriptTimeZone(), "yyyy-MM-dd");
    var filter = "label:" + label + " before:" + dtString;

    var subjects = new Array();
    var count = 0;
    try {
      var threads = GmailApp.search(filter, 0, 100);
      for (var thread = 0; thread < threads.length; thread++) {
        var messages = GmailApp.getMessagesForThread(threads[thread]);
        for (var message = 0; message < messages.length; message++) {
          var email = messages[message];
          if (email.getDate() < cutOff) {
            var subject = email.getFrom() + ": " + email.getSubject();
            subjects.push(subject);
            if (debug) {
              console.log(subject);
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

    var msg = "Deleted " + count + " messages for [" + label + "]";
    console.log(msg);
    return { message: msg, deletedCount: count, subjects: titles};
  }


  run() {
    var summary = [];
    for (var filter = 0; filter < this.config.filters.length; filter++) {
      var result = this.purgeEmails(this.config.filters[filter][0], this.config.filters[filter][1], this.config.debug);
      if (result.deletedCount != 0) {
        summary.push(result.message);
        summary.push("<br/>");
        let sortedSubjects = result.subjects.sort();
        summary = summary.concat(sortedSubjects);
        // console.log(result.subjects);       
        summary.push("<br/><br/>");
      }
    }

    if (this.config.notificationsAddr.indexOf('@') > -1 && summary.length != 0) {
      this.notify("Emails deleted", summary, this.config.notificationsAddr);
    }
  }
}

function GmailDeleteOlderEmails() {
  var runner = new GmailDeleteOlderThan(config);
  runner.run();
}
