/* 
    Google Calendar event modification script.

    If you use this, do let me know so I can notify you if/when I update it.

// https://developers.google.com/apps-script/reference/calendar/calendar
// https://developers.google.com/google-apps/calendar/v3/reference/events

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

/***
 * Parses an RFC 3339 date or datetime string and returns a corresponding Date
 * object. This function is provided as a workaround until Apps Script properly
 * supports RFC 3339 dates. For more information, see
 * https://code.google.com/p/google-apps-script-issues/issues/detail?id=3860
 * @param {string} string The RFC 3339 string to parse.
 * @return {Date} The parsed date.
 */
function parseDate(string) {
  var parts = string.split('T');
  parts[0] = parts[0].replace(/-/g, '/');
  return new Date(parts.join(' '));
}

function GCal(settings) {
    this.settings = settings;
}
GCal.prototype = {
    processEvent: function(eventId, event, calenderId) {

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
                    if (event.start.date) {
                        // All-day event.
                        // var start = parseDate(event.start.date);
                        // Logger.log('%s (%s)', event.summary, start.toLocaleDateString());
                    } else {
                        var eventId = event.id;
                        var ev = Calendar.Events.get(calendarId, eventId);
                        // Logger.log(ev.summary)
                        if (ev.description) {
                            // Logger.log(ev.summary)
                            if (ev.description.indexOf('dropbox.greenhouse.io') != -1) {
                                var start = parseDate(event.start.dateTime);
                                
                                Logger.log('%s, (%s)', ev.summary, start.toLocaleString());
                                
                                if (ev.colorId != 3) {
                                    Logger.log('Updating color');
                                    ev.colorId = 3;
                                    if (!this.settings.debug) {
                                        Calendar.Events.patch(ev, calendarId, eventId)
                                    }
                                }
                            }
                            body.push('')
                        }
                    }
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

    notify: function(subject, body) {
        body.push("", MailApp.getRemainingDailyQuota() + " more emails can be sent today.");
        bodyText = body.join('<br>');

        if (this.settings.log) {
            Logger.log(subject);
            for (var i = 0; i < body.length; i++) {
                Logger.log(body[i]);
            }
        }

        var message = {
            to: this.settings.notificationsAddr,
            subject: "[gscript][GCal]: " + subject,
            htmlBody: bodyText,
        }
        MailApp.sendEmail(message);
    }
};

function gcalRun() {
    var purger = new GCal(settings);
    purger.run();
}