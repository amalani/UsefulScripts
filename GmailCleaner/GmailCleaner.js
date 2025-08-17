/*
Gmail Cleaner Script - Unified Version (Refactored)
==================================================

This script helps you automatically manage your Gmail by tagging and optionally deleting older emails based on labels. 
It's particularly useful for managing promotional emails, newsletters, and other content you only want to keep temporarily.

How It Works
-----------
The script has two main modes:
1. Tag Only Mode: Labels emails for future deletion without removing them
2. Auto Delete Mode: Removes emails that have been previously tagged for deletion

Basic Flow:
1. Create Gmail filters to auto-label incoming emails (e.g., "del/x30" for 30-day retention)
2. The script runs periodically to:
   - Tag Mode: Mark emails older than their retention period
   - Auto Delete Mode: Remove previously tagged emails that also have the auto-delete label
   - Send notification emails about actions taken

Setup Instructions
----------------
1. Go to script.google.com
2. Create a new project
3. Add three files to your project:
   - Copy this script (gmail-cleaner-refactored.js) into the editor
   - Add Utils.js with utility functions
   - Add Config.js with your email address: var Config = { emailAddress: 'your-email@gmail.com' };
4. Configure your settings in the config section below:
   - Set up your retention periods in 'filters'
   - Start with debug: true for testing

5. Initial Testing:
   A. Tag Only Mode Test:
      - Run 'GmailCleanerTagOnlyTest()' function
      - Check logs and email notifications
   
   B. Auto Delete Mode Test:
      - Run 'GmailCleanerAutoDeleteTest()' function
      - Verify correct emails are being processed

6. Production Setup:
   - Set debug: false
   - Set up triggers (clock icon in sidebar):
     * Create trigger for 'GmailCleanerTagOnly()' - run daily
     * Create trigger for 'GmailCleanerAutoDelete()' - run weekly

Label Format
-----------
Primary Labels:
- "del/x30" format (where 30 is days to keep)
- Examples:
  * del/x2  - Keep for 2 days (FilterType.LABEL)
  * del/x7  - Keep for 7 days
  * del/x30 - Keep for 30 days
  * del/x90 - Keep for 90 days
  * del/ax90 - Keep for 90 days but auto deleted (FilterType.AUTO_CLEANUP)

You can use either FilterType.LABEL or FilterType.AUTO_CLEANUP or both. 
FilterType.LABEL is used for emails that are not auto-deleted. I used these to tag emails for manual deletion. If you create a del/auto filter and tag the emails with that label too, those will get auto deleted.
FilterType.AUTO_CLEANUP is used for emails that are auto-deleted.

System Labels:
- d/t       - Marks emails tagged for deletion
- del/auto  - Emails with the above filters (FilterType.LABEL) + this filter both will get deleted. Only used for label filter mode. If you use auto filter type, then just the label name gets used.

Configuration Options
-------------------
debug: true/false         - Test mode vs actual deletions
sendEmails: true/false    - Enable email notifications
limit: number            - Max emails to process per run
cadence: string         - Grouping period (daily/weekly/monthly)
deleteBufferDays: number - Days to wait before deletion

Safety Features
-------------
- Debug mode for testing
- Email notifications
- Configurable retention periods
- Process limits
- Buffer period before deletion

Tips
----
- Start with debug mode ON
- Test with small email batches
- Monitor execution logs
- Check email notifications
- Use shorter periods for newsletters (7-30 days)
- Use longer periods for important emails (90+ days)

Troubleshooting
-------------
- Verify label names exactly match
- Check Gmail permissions
- Review execution logs
- Confirm trigger setup
- Verify label application

For more information: https://github.com/amalani/UsefulScripts/tree/master/GMailDeleteOlderThan
*/

// ===== CONFIGURATION =====

// Script Modes
const ScriptMode = {
    // Only tags the emails
    TAG_ONLY: 'tag-only',
    // Deletes using /auto tag entries
    AUTO_DELETE: 'auto-delete',
    // Deletes using auto tag filter entry
    AUTO_DELETE_TAGS: 'auto-delete-filters',
};

const FilterType = {
    // Filter is a label
    LABEL: 'label',
    // Filter is a filter
    AUTO_CLEANUP: 'auto-label',
};

// Configuration for both modes
var config = {
    // Debug mode - true will only log actions, false will perform deletions
    debug: true,

    // Email retention periods and their labels
    filters: [
        {label: "del/x7", daysToKeep: 7, filterType: FilterType.LABEL},
        {label: "del/x30", daysToKeep: 30, filterType: FilterType.LABEL},
        {label: "del/x90", daysToKeep: 90, filterType: FilterType.LABEL},
        {label: "del/x180", daysToKeep: 180, filterType: FilterType.LABEL},

        {label: "del/ax7", daysToKeep: 7, filterType: FilterType.AUTO_CLEANUP},
        {label: "del/ax30", daysToKeep: 30, filterType: FilterType.AUTO_CLEANUP},
        {label: "del/ax60", daysToKeep: 60, filterType: FilterType.AUTO_CLEANUP}, 
        {label: "del/ax180", daysToKeep: 180, filterType: FilterType.AUTO_CLEANUP},
    ],

    // System labels
    auto_delete_label: 'del/auto',  // Label which contains emails that are safe to delete. This is only used in FilterType.LABEL mode.

    // Process limits
    limit: 30,  // How many max email threads per run

    // Notification settings
    sendEmails: true,  // Enable email notifications
    // emailAddress is loaded from Config.js - see setup instructions below

    // Timing settings
    cadence: "monthly",     // Grouping of emails to be deleted. 'monthly', 'daily', 'fortnight', 'weekly', 'yearly'
    deleteBufferDays: 0,    // No of days to schedule in advance. You need to set a manual trigger for this.
};

// Merge config with Config.js settings
function getFullConfig() {
    if (typeof Config === 'undefined') {
        throw new Error('Config.js file is missing. Please add Config.js with: var Config = { emailAddress: "your-email@gmail.com" };');
    }
    
    return Object.assign({}, config, Config);
}

// ===== UTILITY FUNCTIONS =====
// NOTE: Include these files in your Google Apps Script project:
// 1. Config.js - Contains sensitive configuration (emailAddress, etc.)
// 2. Utils.js - Contains utility functions:
//    - Date Extensions (addDays, getLastSunday, getWeekNumber, getShortMonthName)
//    - GMailLabelUtils (getLabel, getOrCreateLabel, getNestedLabels, isLabelEmpty, isTreeEmpty, deleteEmptyLabels)
//    - MailUtils (sendEmail, sendHtmlEmail)
//    - Configuration validation (validateConfig)
//    - Setup helper (setupGmailCleaner)
//    - Trigger creation (createTriggers)

// ===== MAIN CLASSES =====

// Base class with shared functionality
class GmailCleanerBase {
    constructor(config) {
        this.config = config;
        if (this.config.deleteBufferDays < 0) {
            throw new Error("DeleteBuffer needs to be positive: " + this.config.deleteBufferDays);
        }
    }

    // Shared Label Utilities
    getDeleteLabelPrefix(debug) {
        var deleteLabelPrefix = "d";
        return GMailLabelUtils.getOrCreateLabel(deleteLabelPrefix);
    }

    getDeleteLabelByCadence(debug, cadence, dt) {
        var labelDeletePrefix = this.getDeleteLabelPrefix(debug);
        var suffix = "";
        var dtNow = dt;
        
        if (cadence == "weekly") {
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
            return labelDeletePrefix.getName() + "/" + 
                   Utilities.formatDate(dtNow, Session.getScriptTimeZone(), "yyyy") + suffix;
        } else if (cadence == "monthly") {
            dtNow.setDate(1);
            return labelDeletePrefix.getName() + "/" + 
                   Utilities.formatDate(dtNow, Session.getScriptTimeZone(), "yyyy") + 
                   "." + (dt.getMonth() + 1) + "-" + dt.getShortMonthName() + suffix;
        } else if (cadence == "daily") {
            return labelDeletePrefix.getName() + "/" + dt.getShortMonthName() + "-" + dt.getDate();
        } else {
            throw Error("Cadence " + cadence + " not found.");
        }
        
        return labelDeletePrefix.getName() + "/" + 
               Utilities.formatDate(dtNow, Session.getScriptTimeZone(), "yyyy-MM-dd") + suffix;
    }

    getDeleteLabel(debug, cadence, dtNow) {
        var dt = dtNow || new Date();
        var deleteLabel = this.getDeleteLabelByCadence(debug, cadence, dt);
        return GMailLabelUtils.getOrCreateLabel(deleteLabel);
    }

    getDeleteLabelWithDay(debug, cadence, day, dtNow) {
        var dt = dtNow || new Date();
        var labelDelete = this.getDeleteLabel(debug, cadence, dt);
        var deleteLabel = labelDelete.getName() + "/" + day;
        return GMailLabelUtils.getOrCreateLabel(deleteLabel);
    }

    getDeleteLabelTag(debug) {
        var labelDelete = this.getDeleteLabelPrefix(debug);
        var deleteLabel = labelDelete.getName() + "/t";
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

    // Shared utility for creating email field objects
    createEmailField(email, thread) {
        return {
            dt: email.getDate().toISOString().split("T")[0],
            from: email.getFrom(),
            subject: email.getSubject(),
            url: "https://mail.google.com/mail/u/0/#all/" + thread.getId(),
            starred: thread.hasStarredMessages(),
        };
    }

    // Shared HTML table generation
    generateSummaryTable(results) {
        var summary = [];
        var deletedCount = 0;

        summary.push('<table width="100%" border="1" style="border: 1px solid #ccc; border-collapse: collapse;"><tr><td style="padding: 2px; min-width: 30px; border: 1px solid #ccc;">Date</td><td style="padding: 2px; border: 1px solid #ccc;">Star</td><td style="padding: 2px; border: 1px solid #ccc;">From</td><td style="padding: 2px; border: 1px solid #ccc;">Subject</td></tr>');
        var columnCount = 4;

        for (var i = 0; i < results.length; i++) {
            var result = results[i];
            if (result.deletedCount != 0) {
                deletedCount += result.deletedCount;
                var filterSummary = [];
                filterSummary.push("<tr><td style=\"padding: 2px; border: 1px solid #ccc;\" colspan=\"" + columnCount + "\"><br/>" + result.message + "<br/><br/></td></tr>");
                result.messageFields.sort((a, b) => (a.from > b.from ? 1 : -1));

                for (var j = 0; j < result.messageFields.length; j++) {
                    var isStarred = "";
                    if (result.messageFields[j].starred) {
                        isStarred = "⭐";
                    }
                    filterSummary.push(
                        "<tr><td style=\"padding: 2px; border: 1px solid #ccc;\">" + result.messageFields[j].dt +
                        "</td><td style=\"padding: 2px; border: 1px solid #ccc;\">" + isStarred +
                        "</td><td style=\"padding: 2px; border: 1px solid #ccc;\">" + result.messageFields[j].from +
                        '</td><td style="padding: 2px; border: 1px solid #ccc;"><a href="' + result.messageFields[j].url + '" target="_blank">' +
                        result.messageFields[j].subject + "</a></td></tr>"
                    );
                }
                summary.push(...filterSummary);
            }
        }

        summary.push("</table><br/>&nbsp;<br/>");
        return { summary: summary, totalCount: deletedCount };
    }

    // Abstract method - must be implemented by subclasses
    processEmails(filterConfig) {
        throw new Error("processEmails() must be implemented by subclass");
    }

    // Abstract method - must be implemented by subclasses
    getNotificationMessage(deletedCount) {
        throw new Error("getNotificationMessage() must be implemented by subclass");
    }

    // Shared run method
    run() {
        var results = [];

        // Process each filter
        for (var filter = 0; filter < this.config.filters.length; filter++) {
            var result = this.processEmails(this.config.filters[filter]);
            results.push(result);
        }

        // Generate summary
        var summaryData = this.generateSummaryTable(results);
        var summary = summaryData.summary;
        var deletedCount = summaryData.totalCount;

        // Add notification message
        var notificationData = this.getNotificationMessage(deletedCount);
        summary.unshift(notificationData.message);

        // Send email if configured
        if (this.config.sendEmails && deletedCount > 0) {
            console.log(summary);
            var subject = "[Gmail-Cleaner] " + notificationData.subject;
            MailUtils.sendEmail(this.config.debug, subject, summary, this.config.emailAddress, "[Gmail-Cleaner]");
        }
    }
}

// Tag Only Class (labels emails for deletion)
class GmailTagger extends GmailCleanerBase {
    processEmails(filterConfig) {
        var label = filterConfig.label;
        var days = filterConfig.daysToKeep;
        var debug = this.config.debug;
        var limit = this.config.limit;
        var cadence = this.config.cadence;
        var deleteBufferDays = this.config.deleteBufferDays;
        
        var cutOff = new Date();
        cutOff.setDate(cutOff.getDate() - days);

        var dtString = Utilities.formatDate(cutOff, Session.getScriptTimeZone(), "yyyy-MM-dd");
        var deleteTag = this.getDeleteLabelTag(debug);
        var filter = "label:" + label + " before:" + dtString + " -label:" + deleteTag.getName();

        var deletionDate = this.getDeletionDate(deleteBufferDays);
        var deleteLabelDateOnly = this.getDeleteLabel(debug, cadence, deletionDate);
        var deleteLabelWithDay = this.getDeleteLabelWithDay(debug, cadence, days, deletionDate);

        var fields = [];
        var count = 0;
        
        try {
            var threads = GmailApp.search(filter, 0, limit);
            for (var thread = 0; thread < threads.length; thread++) {
                if (this.threadHasLabel(threads[thread], deleteTag)) {
                    continue;
                }

                var messages = GmailApp.getMessagesForThread(threads[thread]);
                for (var message = 0; message < messages.length; message++) {
                    var email = messages[message];

                    if (email.getDate() < cutOff) {
                        // Add delete tag
                        threads[thread].addLabel(deleteTag);
                        // Add Date label for easy deletes
                        threads[thread].addLabel(deleteLabelDateOnly);
                        // Add delete category / day label (/7 or /30 etc)
                        threads[thread].addLabel(deleteLabelWithDay);

                        fields.push(this.createEmailField(email, threads[thread]));
                        count++;
                    }
                }
            }
        } catch (e) {
            console.log(e);
        }

        var msg = "<strong>" + days + " days: " + count + "</strong> received before " + cutOff.toDateString() +
                  " [<a href='https://mail.google.com/mail/u/0/#label/" + deleteLabelWithDay.getName() + "'>" +
                  deleteLabelWithDay.getName() + "</a>]";
        console.log(msg);
        return { message: msg, deletedCount: count, messageFields: fields };
    }

    getNotificationMessage(deletedCount) {
        var deletionDate = this.getDeletionDate(this.config.deleteBufferDays);
        let label = this.getDeleteLabel(this.config.debug, this.config.cadence, deletionDate);

        var message = "Tagged " + deletedCount + " messages for deletion - assigned label [<a href='https://mail.google.com/mail/u/0/#label/" +
                     label.getName() + "'>" + label.getName() + "</a>].<br/>";
        var subject = "Emails tagged for deletion";

        if (!this.config.debug) {
            message = "Tagged total " + deletedCount + " messages.<br/><br/>";
            subject = "Emails tagged for deletion";
        }

        return { message: message, subject: subject };
    }
}

// Auto Delete Class (deletes tagged emails)
class GmailAutoDeleter extends GmailCleanerBase {
    getAutoDeleteLabelTag(debug) {
        return GMailLabelUtils.getOrCreateLabel(this.config.auto_delete_label);
    }

    processEmails(filterConfig) {
        var label = filterConfig.label;
        var days = filterConfig.daysToKeep;
        var debug = this.config.debug;
        var limit = this.config.limit;
        
        var deleteTag = this.getDeleteLabelTag(debug);

        var filter = "";
        if (filterConfig.filterType == FilterType.AUTO_CLEANUP) {
            // Auto filter mode - Use only the auto filter as the label.
            // Example: del/auto-x30 + del/t
            filter = "label:" + label + " label:" + deleteTag.getName();
        } else if (filterConfig.filterType == FilterType.LABEL) {
            // Label based auto filter - Use label name + auto filter label presence check
            // Example: del/x30 + del/t + del/auto
            var autoDeleteTag = this.getAutoDeleteLabelTag(debug);
            filter = "label:" + label + " label:" + deleteTag.getName() + " label:" + autoDeleteTag.getName();
        } else {
            throw new Error("Invalid filter type: " + filterConfig.filterType);
        }

        console.log("Auto-delete filter: " + filter);

        var fields = [];
        var count = 0;
        
        try {
            var threads = GmailApp.search(filter, 0, limit);
            for (var thread = 0; thread < threads.length; thread++) {
                var messages = GmailApp.getMessagesForThread(threads[thread]);
                for (var message = 0; message < messages.length; message++) {
                    var email = messages[message];

                    console.log(email.getDate().toISOString().split("T")[0] + " " + email.getFrom() + ": " + email.getSubject());

                    fields.push(this.createEmailField(email, threads[thread]));
                    
                    if (!debug) {
                        email.moveToTrash();
                    }
                    count++;
                }
            }
        } catch (e) {
            console.log(e);
        }

        var msg = "<strong>" + days + " days: " + count + " emails deleted</strong> [<a href='https://mail.google.com/mail/u/0/#label/" + label + "'>" + label + "</a>].";
        console.log(msg);

        return { message: msg, deletedCount: count, messageFields: fields };
    }

    getNotificationMessage(deletedCount) {
        var message = "Auto-deleted " + deletedCount + " messages.<br/>";
        var subject = "Emails auto deleted";
        
        if (!this.config.debug) {
            message = "Deleted total " + deletedCount + " messages.<br/><br/>";
            subject = "Emails deleted";
        }

        return { message: message, subject: subject };
    }
}

// ===== MAIN ENTRY POINTS =====

// Main function for tagging emails
function GmailCleanerTagOnly(deleteLabels = false) {
    var fullConfig = getFullConfig();
    var runner = new GmailTagger(fullConfig);
    runner.run();

    if (deleteLabels) {
        deleteEmptyLabelsWithConfig(fullConfig);
    }
}

// Main function for auto-deleting emails
function GmailCleanerAutoDelete(deleteLabels = false) {
    var fullConfig = getFullConfig();
    var runner = new GmailAutoDeleter(fullConfig);
    runner.run();

    if (deleteLabels) {
        deleteEmptyLabelsWithConfig(fullConfig);
    }
}

// Main function for auto-deleting emails
function GmailCleanerDeleteEmptyLabels(deleteLabels = true) {
    var fullConfig = getFullConfig();
      deleteEmptyLabelsWithConfig(fullConfig);
}

// Unified entry point
function GmailCleaner(mode = "tag") {
    if (mode === "delete") {
        GmailCleanerAutoDelete(false);
    } else {
        GmailCleanerTagOnly(false);
    }
}

// Test functions
function GmailCleanerTagOnlyTest() {
    var fullConfig = getFullConfig();
    var testConfig = {...fullConfig};
    testConfig.debug = true;
    testConfig.limit = 10; // Limit for testing
    
    var runner = new GmailTagger(testConfig);
    runner.run();
}

function GmailCleanerAutoDeleteTest() {
    var fullConfig = getFullConfig();
    var testConfig = {...fullConfig};
    testConfig.debug = true;
    testConfig.limit = 10; // Limit for testing
    
    var runner = new GmailAutoDeleter(testConfig);
    runner.run();
}

function GmailCleanerTest(mode = ScriptMode.TAG_ONLY) {
    if (mode === ScriptMode.AUTO_DELETE) {
        GmailCleanerAutoDeleteTest();
    } else {
        GmailCleanerTagOnlyTest();
    }
}

// ===== HELPER FUNCTIONS =====
// These functions use the utilities from Utils.js

// Helper function that uses GMailLabelUtils.deleteEmptyLabels
function deleteEmptyLabelsWithConfig(config) {
    GMailLabelUtils.deleteEmptyLabels(config);
}

// Setup helper that uses config parameter
function setup() {
    var fullConfig = getFullConfig();
    if (!validateConfig(fullConfig)) {
        throw new Error("Invalid configuration. Please check the logs and fix the issues.");
    }

    setupGmailCleaner(fullConfig);
}

// Quick test with limited emails
function quickTest() {
    var fullConfig = getFullConfig();
    var testConfig = {...fullConfig};
    testConfig.debug = true;
    testConfig.limit = 5;  // Process only 5 emails for testing
    
    console.log("=== Testing Tag Mode ===");
    var tagRunner = new GmailTagger(testConfig);
    tagRunner.run();
    
    console.log("=== Testing Auto-Delete Mode ===");
    var deleteRunner = new GmailAutoDeleter(testConfig);
    deleteRunner.run();
    
    console.log("Quick test completed - check logs for results");
}
