/* 
    Google Calendar event modification script.

    If you use this, do let me know so I can notify you if/when I update it.

// Google calendar developer API reference: 
// https://developers.google.com/apps-script/reference/calendar/calendar
// V3/Advanced API - used for advanced manipulation.
// https://developers.google.com/google-apps/calendar/v3/reference/events
// https://developers.google.com/apps-script/advanced/calendar

// When run, you'll get an email like this:
You'll get an email like this: 
November 18, 2016 10:30:00 AM PST: <event title>
Color updated
November 21, 2016 3:00:00 PM PST: <event title> 
Color update not needed.
*/

var settings = {
    notificationsAddr: '<enter your email address here>',   // Leave blank for no emails.
    debug: true,                                            // No changes, log only.
    log: true,                                             // Should log?
    eventCount: 25,                                         // Process the next 'eventCount' events from now.
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
    processEventHelperColorCodeByDescription: function(calendarId, eventId, event, eventStartStr, body, searchTerm, colorId) {
        // Look for searchTerm in the description field of the event and if found, change the color of the event
        // to the passed in colorId.
        // See colorIds here: https://developers.google.com/apps-script/reference/calendar/color or 
        // call Calendar.Colors.get()
        if (event.description && event.description.indexOf(searchTerm) != -1) {
            body.push(eventStartStr + ': ' + event.summary);
            if (event.colorId == colorId) {
                body.push('Color update not needed')
            } else {
                body.push('Color updated');
                event.colorId = colorId;
                if (!this.settings.debug) {
                    Calendar.Events.patch(event, calendarId, eventId);
                }
            }
        }
    },

    // Called once for each event.
    processEvent: function(calendarId, eventId, body) {
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
            calendarId, eventId, event, eventStartStr, body, 'dropbox.greenhouse.io', 3
        );
        // if (event.description) {
        //     if (event.description.indexOf('dropbox.greenhouse.io') != -1) {
        //         body.push(eventStartStr + ': ' + event.summary);
        //         if (event.colorId != 3) {
        //             body.push('Updating color');
        //             event.colorId = 3;
        //             if (!this.settings.debug) {
        //                 Calendar.Events.patch(event, calendarId, eventId)
        //             }
        //         }
        //         else {
        //             body.push('Color update not needed');
        //         }

        //         body.push('')
        //     }
        // }
    },

    run: function() {
        var body = [];
        var calendarId = 'primary';         // This picks your primary calendar.
        var now = new Date();

        try {
            // Get the next 'eventCount' events from now.
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
                    this.processEvent(calendarId, eventId, body);
                }
            } else {
                body.push('No events found.');
            }
        }
        catch (ex) {
            body.push('Exception: ' + ex.message);
        }

        var subject = "Script run results";
        this.notify(subject, body);
    },

    // Send an email and/or log.
    notify: function(subject, body) {
        body.push("", MailApp.getRemainingDailyQuota() + " more emails can be sent today.");
        bodyText = body.join('<br>');
        subjectText = '[gscript][GCal]: ' + subject;
        if (this.settings.debug) {
            subjectText += '[debug mode]';
        }

        if (this.settings.log) {
            Logger.log(subjectText);
            for (var i = 0; i < body.length; i++) {
                Logger.log(body[i]);
            }
        }

        var message = {
            to: this.settings.notificationsAddr,
            subject: subjectText,
            htmlBody: bodyText,
        }
        MailApp.sendEmail(message);
    }
};

function gcalRun() {
    var purger = new GCal(settings);
    purger.run();
}