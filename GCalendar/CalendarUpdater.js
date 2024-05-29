// Make sure to replace 'YOUR_CALENDAR_ID' with the actual ID of your Google Calendar. You can find the calendar ID by going to your Google Calendar settings and selecting the calendar you want to color code. The ID will be displayed under the "Integrate calendar" section.

// To use this script:

// Open your Google Calendar.
// Click on the settings gear icon and choose "View all settings."
// Go to the "Advanced" tab and enable "Google Apps Script."
// Click on the "Script Editor" option that appears in the settings menu.
// Delete any existing code in the script editor and paste the provided code.
// Modify the criteria and colors in the colorCodeCalendarEvents function to fit your requirements.
// Save the script by clicking the floppy disk icon or pressing Ctrl + S.
// Close the script editor and refresh your calendar.
// The script will run whenever you open your calendar or when a new event is created. It will color code the events according to your defined criteria and colors.

var operations = 0;

function calendarEventTweaker() {
  var days = 3;  // Number of days of future events to pick up
  var tagTitle = 'title-tweaker-title';
  var tagColor = 'title-tweaker-color';

  var calendarId = 'abhishekm@dropbox.com';
  var calendar = CalendarApp.getCalendarById(calendarId);

  var oneDayms = 24 * 60 * 60 * 1000;
  // Fetch events for the next 'days' days
  var events = calendar.getEvents(
    new Date(new Date().getTime() - (oneDayms)),  // -1 day 
    new Date(new Date().getTime() + (days * oneDayms))  // days in the future?
  );

  Logger.log("Total " + events.length + " events.");
  for (var e = 0; e < events.length; e++) {
    var event = events[e];
    var eventTitle = event.getTitle();

    try {
      _updateTitle(event, eventTitle, tagTitle, tagColor);
    } catch (ex) {

    }
    
    if (!event.getColor()) {
      _colorCodeCalendarEvent(event, eventTitle)
    }
  }

  Logger.log("Operations: " + operations);
}

var emojis = [
   [":f:", "🧑‍💻"]
  ,["#f", "🧑‍💻"]
  ,[":focus:", "🧑‍💻"]  
  ,[":coffee:", "☕",]
  ,[":lunch:", "🍔"]
  ,[":child:", "🧒🏻"]
];

function _updateTitle(event, eventTitle, tag) {
  // Update events owned by me
  if (event.isOwnedByMe() && 
      !event.isAllDayEvent()
      && true)
  {
    operations++;
    // Logger.log(eventTitle);
    var tags = event.getAllTagKeys();
    var tagsList = tags.join(',');
    var isReclaim = tagsList.includes('reclaim')
    var isTitleUpdated = tagsList.includes(tag)
    if (!isReclaim && !isTitleUpdated && eventTitle.includes(':')) {
      // Logger.log(event.getStartTime().toLocaleString() + " " + eventTitle);

      var newTitle = eventTitle;
      for (var i = 0; i < emojis.length; i++) {
        newTitle = newTitle.split(emojis[i][0]).join(emojis[i][1]);
      }
      event.setTitle(newTitle);
      event.setTag('tag', 1);
      // Logger.log(newTitle);
    }
  }  
}

function _colorCodeCalendarEvent(event, eventTitle, tag) {
  try {
    // The tags help avoid processing the same event multiple times
    var tags = event.getAllTagKeys();
    var tagsList = tags.join(',');  
    var isColorUpdated = tagsList.includes('am-color-updated');
    var isColorProcessed = tagsList.includes('am-color-processed');
    // Logger.log(eventTitle, "; [color updated: " + isColorUpdated + "]");
    if (!isColorUpdated && !isColorProcessed) {
      var one_one_ones = ['/Abhishek', 'Abhishek/', 'Abhishek /', ':Abhishek', 'Abhishek [w]', ': Abhishek', '1:1'];
      var color = CalendarApp.EventColor.PALE_GREEN;
      for(var i=0; i<one_one_ones.length; i++) {
        operations++;
        if (event.getColor() != color && eventTitle.includes(one_one_ones[i])) {
          event.setColor(color);
          event.setTag('am-color-updated', 1);
          break;
        }
      }
    }
    if (!isColorProcessed) {
      try {
        event.setTag('am-color-processed', 1);
      }
      catch(err) {
        // can't update events not owned by you
      }
    }
  } catch (err) {
    // MailApp.sendEmail('email@gmail.com', "Error", eventTitle + " " + err.toString());
    // Logger.log("Email sent for exception");
  }
}
