/* 
    Google Calendar event modification script.

    If you use this, do let me know so I can notify you if/when I update it.

// https://developers.google.com/apps-script/reference/calendar/calendar
// https://developers.google.com/google-apps/calendar/v3/reference/events
*/

var settings = {
    notificationsAddr: "<enter your email address here>",   // Leave blank for no emails.
    debug: true,                                            // No changes, log only.
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
    constructor: GCal,

    notify: function(subject, body) {
        body.push("<br><br>" + MailApp.getRemainingDailyQuota() + " more emails can be sent today.");
        bodyText = body.join('<br>');
        var message = {
            to: this.settings.notificationsAddr,
            subject: "[gscript][GCal]: " + subject,
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

    run: function() {
        var body = [];
        var stats = { threads: 0, processed: 0 }

        try {
            // // body.push('Emails deleted:');
            // var day = new Date();
            // for (var i = 0; i < 3; i++) {
            //     Logger.log(day)
            //     var events = CalendarApp.getDefaultCalendar().getEventsForDay(day);
            //     Logger.log('Number of events: ' + events.length);

            //     for (var e = 0; e < events.length; e++) {
            //         var ev = events[e];
            //         var id = ev.getId();
            //         Logger.log(id);

            //     }

            //     day = day.addDays(1);
            // }


            var calendarId = 'primary';
            var now = new Date();
            var events = Calendar.Events.list(calendarId, {
                timeMin: now.toISOString(),
                singleEvents: true,
                orderBy: 'startTime',
                maxResults: 25
            });

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
                                    Calendar.Events.patch(ev, calendarId, eventId)
                                }
                            }
                            Logger.log('')
                        }
                        // // Logger.log('%s (%s)', event.summary, start.toLocaleString());
                        // if (event.summary.toLowerCase().indexOf('interview') != -1 ||
                        //     event.description.toLowerCase().indexOf('dropbox.greeenhouse.io') != -1) {
                        //     Logger.log('%s (%s)', event.summary, start.toLocaleString());
                        //     var ev = Calendar.Events.get(calendarId, event.id)
                        //     Logger.log("Current color: ", ev.colorId);
                        //     ev.colorId = 3;
                        //     Calendar.Events.patch(ev, calendarId, event.id)
                        // }

                    }
                }
            } else {
                Logger.log('No events found.');
            }
        }
        catch (ex) {
            body.push('Exception: ' + ex.message);
        }

        // var subject = 'Deleted ' + stats.processed + ' emails from ' + stats.threads + ' threads.';
        var subject = "entries updated";
        this.notify(subject, body);
    }
};

var purger = new GCal(settings);
purger.run();