/* 
    Google Calendar event modification script.
    If you use this, do let me know so I can notify you if/when I update it. Feel free to send 
    pull requests.

    The basic processEventHelperColorCodeByDescription lets you find events that contain text
    you search for in the event's description field and change their color to the color you specify.

    When run, if you the processEventHelperColorCodeByDescription line in processEvents() finds events
    that have the passed in text in their description, you should get an email that looks like this
        November 18, 2016 10:30:00 AM PST: <event title>
        Color updated
        November 21, 2016 3:00:00 PM PST: <event title> 
        Color update not needed.

    See foot notes for instructions.
*/

var settings = {
    notificationsAddr: '<enter your email address here>',   // Leave blank for no emails.
    debug: false,                                           // If true, do not commit - helpful when editing the script.
    log: true,                                              // Should log? (results appear in View -> Log)
    email: true,                                            // Should send email (turn it off if you've set the trigger to run very often')
    eventCount: 20,                                         // Process the next 'eventCount' events from now.
}

// -- Do not touch code below this.
Date.prototype.addDays = function(days) {
    var d = new Date(this.valueOf());
    d.setDate(d.getDate() + days);
    return d;
}
// RFC 3339 date/datetime parser. Adapted from https://code.google.com/p/google-apps-script-issues/issues/detail?id=3860
String.prototype.parseRFC3339Date = function() {
    var parts = this.split('T');
    parts[0] = parts[0].replace(/-/g, '/');
    return new Date(parts.join(' '));
}

function GCal(settings) {
    this.settings = settings;
    this.body = [];
}
GCal.prototype = {
    // Event processing helpers.
    processEventHelperColorCodeByDescription: function(calendarId, eventId, event, eventStartStr, searchTerm, colorId) {
        // Look for searchTerm in the description field of the event and if found, change the color of the event
        // to the passed in colorId.
        // See colorIds here: https://developers.google.com/apps-script/reference/calendar/color or 
        // call Calendar.Colors.get()
        if (event.description && event.description.indexOf(searchTerm) != -1) {
            this.body.push(eventStartStr + ': ' + event.summary);
            if (event.colorId == colorId) {
                this.body.push('Color update not needed')
            } else {
                this.body.push('Color updated');
                event.colorId = colorId;
                if (!this.settings.debug) {
                    Calendar.Events.patch(event, calendarId, eventId);
                }
            }
        }
    },

    // Called once for each event.
    processEvent: function(calendarId, eventId) {
        // This refers to the event object mentioned here: https://developers.google.com/google-apps/calendar/v3/reference/events
        // Note - all fields may not be present in each event so always do if (event.field) check before accessing.
        var event = Calendar.Events.get(calendarId, eventId);
        
        // Event start
        var eventStart = '', eventStartStr = '';
        if (event.start.date) { // All day event
            eventStart = String(event.start.date).parseRFC3339Date();
            eventStartStr = eventStart.toLocaleDateString();
        } else {
            eventStart = String(event.start.dateTime).parseRFC3339Date();
            eventStartStr = eventStart.toLocaleString();
        }

        // Event processors:
        // Color code events containing the passed in search term to the passed in colorId.
        this.processEventHelperColorCodeByDescription(
            calendarId, eventId, event, eventStartStr, 'SEARCH_FOR_THIS', 3
        );
        // Add more event processors here:


        // Stop editing file here.
    },

    run: function() {
        var calendarId = 'primary';         // This picks your primary calendar.
        var now = new Date();

        try {
            // Get the next 'eventCount' events from now.
            // https://developers.google.com/google-apps/calendar/v3/reference/events/list
            var events = Calendar.Events.list(calendarId, {
                timeMin: now.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                maxResults: this.settings.eventCount,
            });

            // The API surface sometimes results in fields that may not be set. Always check
            // whether a field exists before accessing it.
            if (events.items && events.items.length > 0) {
                for (var i = 0; i < events.items.length; i++) {
                    var event = events.items[i];
                    var eventId = event.id;
                    this.processEvent(calendarId, eventId, this.body);
                }
            } else {
                this.body.push('No events found.');
            }
        }
        catch (ex) {
            this.body.push('Exception: ' + ex.message);
        }

        var subject = "Script run results";
        this.notify(subject, this.body);
    },

    // Send an email and/or log.
    notify: function(subject) {
        this.body.push("", MailApp.getRemainingDailyQuota() + " more emails can be sent today.");
        bodyText = this.body.join('<br>');
        subjectText = '[gscript][GCal]: ' + subject;

        if (this.settings.debug) {
            subjectText += '[debug mode]';
        }

        if (this.settings.log) {
            Logger.log(subjectText);
            for (var i = 0; i < this.body.length; i++) {
                Logger.log(this.body[i]);
            }
        }

        if (this.settings.email) {
            var message = {
                to: this.settings.notificationsAddr,
                subject: subjectText,
                htmlBody: bodyText,
            }
            MailApp.sendEmail(message);
        }
    }
};

function gcalRun() {
    var gcal = new GCal(settings);
    gcal.run();
}

/* 
    Foot notes:

    Instructions:
    1. Go to script.google.com
    2. If asked - provide authorization.
    3. Click on Resources -> Advanced Google Services -> Enable Calendar API.
    4. Create a new project, add new file - paste the contents of this file.
    5. Update the settings block at the top of the file.
    6. I have provided a basic helper 'processEventHelperColorCodeByDescription' that looks at the 
       description of each event and changes the event's color if the text is found. Update this
       to match the search text you want and colorId. You can add more such methods and call them 
       from processEvent()

       Look for 
        this.processEventHelperColorCodeByDescription(
            calendarId, eventId, event, eventStartStr, 'SEARCH_FOR_THIS', 3
        );
        and change 'SEARCH_FOR_THIS' to the text you want to match in the event description.

    7. Run the gcalRun script from the toolbar and check if the changes are reflected. The first time
       the script is run, it may ask you to authorize access to your calendar.
    8. Once verified, I change the settings.eventCount property to about two weeks worth of events in
       my calendar.
    9. Since people can add events to your calendar at any time, add a trigger from the toolbr
       that runs the script every hour or two so ensure we don't miss events.
    10.By default, the script sends an email every time it is run. You may want to turn it off by editing
       the settings block.


    Google calendar developer API reference: 
        https://developers.google.com/apps-script/reference/calendar/calendar
        V3/Advanced API - used for advanced manipulation.
            https://developers.google.com/google-apps/calendar/v3/reference/events
            https://developers.google.com/apps-script/advanced/calendar
*/