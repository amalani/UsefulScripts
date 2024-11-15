/*
Script that lets you use GoogleScript engine to delete emails older than x days in particular labels.

The way it would work is you use gmail filters to auto tag emails with certain labels (I use .dXX but you can use any). 
Then I filter promotional emails and set them to label 30 days, or some emails I want to keep longer - I put them in the 90 day label.
Then update the filters array below to match your label names and cut off date. The script will run and keep the last x days of emails in the 
Due to run time limits, I only deleted 100 emails per label per run - so if you have more, you may need to run it more often (you can set the trigger to every few hours or every day and it will keep doing its work in the background) 

--- 

1. Go to script.google.com.
2. Create a new project.
3. Paste this script.
4. Update the filters below.
5. Run - Press the play button in the top nav (ensure the method name in the drop down next to it is clearEmails() and not tagEmails())
    - On first run - you'll get asked permission to allow access to your gmail account.
6. View Logger - verify working as expected.
7. Set debug to false.

// Later once you've verified this works as you'd like.

9. Go to the trigger tab (see alarm icon in left navigation) - set it to run every few hours or every day etc.


// Problems solved
- Identify emails beyond a particular date

Basically merging the real vs deletion versions of the script and having mark for deletion operate differently than actual deletion.

1. Find emails in d/x## folders
2. Mark deletion in d/s/date (today + 7 days)
3. Send email about deletion
4. Delete at later stage.


TODO: 
//
// Add not starred filter
// add quick lookups to find email in trash


https://stackoverflow.com/questions/1129216/sort-array-of-objects-by-string-property-value
*/

// https://dmitripavlutin.com/javascript-enum/

// const ScriptMode = {
//   TAG_ONLY: 'tag_only',
//   AUTO_DELETE: 'auto-delete',
// }

var config_tag_only = {
    // true/false -> true will only log to console, false will actually delete.
    debug: true,
  
    // These represent labels and the days you want to keep them - for instance, anything I want to keep only the most recent 7 days' emails, I label them with the .d7 label on row 1.
    // You can add as many such label/day combos as you like. I've commented the last two as an example.
    filters: [
       ["del/x7", 7]
      ,["del/x30", 30]
      ,["del/x60", 60]
      ,["del/x90", 90]
      ,["del/x180", 180]
      ,["del/x365", 365]
    ],
  
    auto_delete_label: 'del/auto', // Label which contains emails that are safe to delete
  
    limit: 50, // How many max email threads per run
  
    sendEmails: true, // Set Email addr in Config.emailAddr
  
    cadence: "monthly", // Grouping of emails to be deleted. 'monthly', 'daily', 'fortnight', 'weekly', 'yearly'
  
    deleteBufferDays: 0, // No of days to schedule in advance. You need to set a manual trigger for this.
  
    mode: ScriptMode.TAG_ONLY,
  };
  
  var config_auto_delete = { ...config_tag_only };
  config_auto_delete.mode = ScriptMode.AUTO_DELETE;
  
  
  
  class GmailDeleteOlderThanTagOnlyAndAutoPrune {
    constructor(config) {
      this.config = config;
      if (this.config.deleteBufferDays < 0) {
        throw new Error(
          "Delebuffer needs to be positive: " + this.conffig.deleteBufferDays
        );
      }
    }
  
    // Label Utilities
    getDeleteLabelPrefix(debug) {
      var deleteLabelPrefix = "d";
      return GMailLabelUtils.getOrCreateLabel(deleteLabelPrefix);
    }
  
    getDeleteLabelByCadence(debug, cadence, dt) {
      var labelDeletePrefix = this.getDeleteLabelPrefix(debug);
      var suffix = "";
      var dtNow = dt;
      if (cadence == "weekly") {
        // Get most recent start of week Sunday
        dtNow = dtNow.getLastSunday();
        suffix = "-w" + dtNow.getWeekNumber();
        return labelDeletePrefix.getName() + "/" + dtNow.getShortMonthName() + "-" + dtNow.getDate();
      } else if (cadence == "fortnight") {
        if (dtNow.getDate() <= 14) {
          dtNow.setDate(1);
        } else {
          dtNow.setDate(15);
        }
        suffix = "-bm";
      } else if (cadence == "yearly") {
        dtNow.setDate(1);
        return (
          labelDeletePrefix.getName() +
          "/" +
          Utilities.formatDate(dtNow, Session.getScriptTimeZone(), "yyyy") +
          suffix
        );
      } else if (cadence == "monthly") {
        dtNow.setDate(1);
        // suffix = '-monthly'
        return (
          labelDeletePrefix.getName() +
          "/" +
          Utilities.formatDate(dtNow, Session.getScriptTimeZone(), "yyyy") + "-" + dt.getShortMonthName() +
          suffix
        );
      } else if (cadence == "daily") {
        // May-1
        return labelDeletePrefix.getName() + "/" + dt.getShortMonthName() + "-" + dt.getDate();
      } else {
        throw Error("Cadence " + cadence + " not found.");
      }
      return (
        labelDeletePrefix.getName() +
        "/" +
        Utilities.formatDate(dtNow, Session.getScriptTimeZone(), "yyyy-MM-dd") +
        suffix
      );
    }
  
    getDeleteLabel(debug, cadence, dtNow) {
      var dt = dtNow || new Date();
      var deleteLabel = this.getDeleteLabelByCadence(debug, cadence, dtNow);
      return GMailLabelUtils.getOrCreateLabel(deleteLabel);
    }
  
    getDeleteLabelWithDay(debug, cadence, day, dtNow) {
      var dt = dtNow || new Date();
      var labelDelete = this.getDeleteLabel(debug, cadence, dt);
      var deleteLabel = labelDelete.getName() + "/" + day;
      return GMailLabelUtils.getOrCreateLabel(deleteLabel);
    }
  
    // Mark items with this so they don't get labeled again if the previous instance hasn't deleted them.
    getDeleteLabelTag(debug) {
      var labelDelete = this.getDeleteLabelPrefix(debug);
      var deleteLabel = labelDelete.getName() + "/t";
      return GMailLabelUtils.getOrCreateLabel(deleteLabel);
    }
  
    getAutoDeleteLabelTag(debug) {
      var labelDelete = this.getDeleteLabelPrefix(debug);
      // var deleteLabel = labelDelete.getName() + "/auto";
      var deleteLabel = "del/auto";
      return GMailLabelUtils.getOrCreateLabel(deleteLabel);
    }
  
    threadHasLabel(thread, label) {
      var labels = thread.getLabels();
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].getName() == label.getName()) {
          return true;
        }
      }
      return false;
    }
  
    getDeletionDate(bufferDays) {
      return new Date().addDays(bufferDays);
    }
  
    autoPurgeEmails(label, days, debug, limit, cadence, deleteBufferDays) {
      var cutOff = new Date();
      cutOff.setDate(cutOff.getDate() - days);
  
      var dtString = Utilities.formatDate(
        cutOff,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd"
      );
  
      // d/t + d/auto
      var deleteTag = this.getDeleteLabelTag(debug);
      var autoDeleteTag = this.getAutoDeleteLabelTag(debug);
      var filter =
        "label:" +
        label +
        // " before:" +
        // dtString +
        " label:" + deleteTag.getName()
        + " label:" + autoDeleteTag.getName();
  
        console.log(filter);
    
  
      // Date labels
      // This is the run date + cadence -> 2024-04-27 or 2024-04 etc
      // var deleteLabelDateOnly = this.getDeleteLabel(debug, cadence, deletionDate);
      // This is the sub date with day ie: 2024-04-27/7 or 2024-04/7
      // TODO: Change this to use ^^ previous parent label + add days to it.
      // Date on which these should be deleted -> now + this.config.deleteBufferDays
      var deletionDate = this.getDeletionDate(deleteBufferDays);
  
      // Date labels
      // This is the run date + cadence -> 2024-04-27 or 2024-04 etc
      var deleteLabelDateOnly = this.getDeleteLabel(debug, cadence, deletionDate);
      // This is the sub date with day ie: 2024-04-27/7 or 2024-04/7
      // TODO: Change this to use ^^ previous parent label + add days to it.
      var deleteLabelWithDay = this.getDeleteLabelWithDay(
        debug,
        cadence,
        days,
        deletionDate
      );
  
  
      // Email fields
      var fields = new Array();
      var count = 0;
      try {
        var threads = GmailApp.search(filter, 0, limit);
        for (var thread = 0; thread < threads.length; thread++) {
          // Check for tag
          // if (this.threadHasLabel(threads[thread], deleteTag)) {
          //   continue;
          // }
  
          var messages = GmailApp.getMessagesForThread(threads[thread]);
          for (var message = 0; message < messages.length; message++) {
            var email = messages[message];
  
            console.log(email.getDate().toISOString().split("T")[0] + " " + email.getFrom() + ": " + email.getSubject());
            // continue;
  
            // // Add delete tag
            // threads[thread].addLabel(deleteTag);
  
            // // Add Date label for easy deletes
            // threads[thread].addLabel(deleteLabelDateOnly);
  
            // // Add delete category / day label (/7 or /30 etc)
            // threads[thread].addLabel(deleteLabelWithDay);
  
            // if (debug) {
            //   // console.log(email.getFrom() + ": " + email.getSubject());
            // } else {
            //   // console.log("Add label" + deleteLabel.getName())
            //   // email.moveToTrash();
            // }
  
            fields.push({
              dt: email.getDate().toISOString().split("T")[0],
              from: email.getFrom(),
              subject: email.getSubject(),
              url:
                "https://mail.google.com/mail/u/0/#all/" +
                threads[thread].getId(),
              // inbox: email.isInInbox(),
              starred: threads[thread].hasStarredMessages(),
            });
            email.moveToTrash();            
            count++;
          }
        }
      } catch (e) {
        console.log(e);
      }
  
      var msg =
        "<strong>" +
        days +
        " days: " +
        count +
        "</strong> &nbsp; &nbsp; [<a href='https://mail.google.com/mail/u/0/#label/" +
        deleteLabelWithDay.getName() +
        "'>" +
        deleteLabelWithDay.getName() +
        "</a>] received before " +
        cutOff.toDateString() +
        "</strong>";
  
      if (!debug) {
        msg =
          "<strong>" +
          days +
          " days: " +
          count +
          " received before " +
          cutOff.toDateString() +
          "</strong>";
      }
      console.log(msg);
  
      return { message: msg, deletedCount: count, messageFields: fields };
    }
  
    list() {
      var threads = GmailApp.getInboxThreads(0, 20);
      for (var i = 0; i < threads.length; i++) {
        Logger.log(threads[i].getFirstMessageSubject());
      }
    }
  
    run() {
  
      var summary = [];
      var deletedCount = 0;
  
      summary.push("<table border=\"1\" width=\"100%\" style=\"border-color: #000000; border-collapse: collapse;\"><tr><td>Date</td><td>Star</td><td>From</td><td>Subject</td></tr>");
      var columnCount = 4;
  
      for (var filter = 0; filter < this.config.filters.length; filter++) {
        var result = this.autoPurgeEmails(
          this.config.filters[filter][0],
          this.config.filters[filter][1],
          this.config.debug,
          this.config.limit,
          this.config.cadence,
          this.config.deleteBufferDays,
        );
  
        if (result.deletedCount != 0) {
          deletedCount += result.deletedCount;
          var filterSummary = [];
          filterSummary.push("<tr><td colspan=\"" + columnCount + "\"><br/>" + result.message + "<br/><br/></td></tr>");
          // result.messageFields.sort((a,b) => (a.from > b.from) ? 1 : ((b.from > a.from) ? -1 : 0));
          result.messageFields.sort((a, b) => (a.from > b.from ? 1 : -1));
  
          for (var i = 0; i < result.messageFields.length; i++) {
            var isStarred = "";
            if (result.messageFields[i].starred) {
              isStarred = "⭐";
            }
            filterSummary.push(
              "<tr><td>" +
                result.messageFields[i].dt +
                "</td><td>" +
                isStarred +
                "</td><td>" +
                result.messageFields[i].from +
                '</td><td><a href="' +
                result.messageFields[i].url +
                '" target="_blank">' +
                result.messageFields[i].subject +
                "</a></td></tr>"
            );
          }
          summary.push(...filterSummary);
        }
      }
  
      summary.push("</table><br/>&nbsp;<br/>");
  
      // Add Summary Header
      // Date on which these should be deleted -> now + this.config.deleteBufferDays
      var deletionDate = this.getDeletionDate(this.config.deleteBufferDays);
      let label = this.getDeleteLabel(
        this.config.debug,
        this.config.cadence,
        deletionDate,
      );
      var message =
        "Deleted total " +
        deletedCount +
        " messages - assigned label [<a href='https://mail.google.com/mail/u/0/#label/" +
        label.getName() +
        "'>" +
        label.getName() +
        "</a>].<br/>";
      var subject = "Emails auto deleted";
      if (!this.config.debug) {
        message = "Deleted total " + deletedCount + " messages.<br/><br/>";
        subject = "Emails deleted";
      }
      summary.unshift(message);
  
      if (
        this.config.sendEmails && deletedCount > 0
      ) {
        console.log(summary);
        MailUtils.sendEmail(false, subject, summary, Config.emailAddress, "Gmail-Delete-Older-Than");
      }
    }
  }
  
  function GmailDeleteOlderEmailsThanTagOnlyAndAutoPrune(deleteLabels) {
    // Add Labels only
    // var runner = new GmailDeleteOlderThanTagOnlyAndAutoPrune(config_tag_only);
    // runner.run();
  
    var runner = new GmailDeleteOlderThanTagOnlyAndAutoPrune(config_auto_delete);
    runner.run();
  
    if (deleteLabels) {
      deleteEmptyLabels();
    }
  }
  
  // function GmailDeleteOlderEmailsTagOnlyAndEmptyLabels() {
  //   GmailDeleteOlderEmailsTagOnly(true);
  // }
  
  // /// Thinking for auto delete
  // // Can't look at email filters. Need to look at .t tag + .auto tag that are older than x/number days a
  
  function GmailDeleteOlderThanTagOnlyAndAutoPruneTest() {
    GmailDeleteOlderEmailsThanTagOnlyAndAutoPrune(false);
  }
  