/*
Script that lets you use GoogleScript engine to delete emails older than x days in particular labels.

The way it would work is you use gmail filters to auto tag emails with certain labels (I use .delete_x but you can use any). 
Then I filter promotional emails and set them to label 30 days, or some emails I want to keep longer - I put them in the 90 day label.
Then update the filters array below to match your label names and cut off date. The script will run and keep the last x days of emails in the 
Due to run time limits, I only deleted 100 emails per label per run - so if you have more, you may need to run it more often (you can set the trigger to every few hours or every day and it will keep doing its work in the background) 

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

*/


var config = {
  // true/false -> true will only log to console, false will actually delete.
  debug: false,

  // These represent labels - for example the ".delete_7" label I want to delete emails older than 7 days.
  // You can add as many such labels as you like. I've commented the last two as an example 
  filters: [
     ['.d7', 7]
    ,['.d30', 30]
    ,['.d60', 60]  
    ,['.d90', 90]
    ,['.d180', 180]
  ],
};

function GmailDeleteOlderThan(config) {
  this.config = config;
}

GmailDeleteOlderThan.prototype = {
  constructor: GmailDeleteOlderThan,

  purgeEmails: function(label, days, debug) {
    var cutOff = new Date();
    cutOff.setDate(cutOff.getDate() - days)
  
    var dtString  = Utilities.formatDate(cutOff, Session.getScriptTimeZone(), "yyyy-MM-dd");
    var filter = "label:" + label + " before:" + dtString;
  
    var count = 0;
    try {
      var threads = GmailApp.search(filter, 0, 100);
        for (var thread = 0; thread < threads.length; thread++) {
        var messages = GmailApp.getMessagesForThread(threads[thread]);
        for (var message = 0; message < messages.length; message++) {
          var email = messages[message];       
          if (email.getDate() < cutOff) {          
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
  },
  
  run: function() {
    console.log("Start")
    for (var filter = 0; filter < this.config.filters.length; filter++) {
      this.purgeEmails(this.config.filters[filter][0], this.config.filters[filter][1], this.config.debug);
    }
  }  
}

var runner = new GmailDeleteOlderThan(config);
runner.run();
