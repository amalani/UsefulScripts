// ===== UTILITY FUNCTIONS =====

// Date Extensions
Date.prototype.addDays = function (days) {
    const date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
};

Date.prototype.getLastSunday = function () {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() - date.getDay());
    return date;
};

Date.prototype.getWeekNumber = function() {
    let janFirst = new Date(this.getFullYear(), 0, 1);
    let numberOfDays = Math.floor((this - janFirst) / (24 * 60 * 60 * 1000));
    return Math.ceil((janFirst.getDay() + 1 + numberOfDays) / 7);
};

Date.prototype.getMonthName = function() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    return monthNames[this.getMonth()];
};

Date.prototype.getShortMonthName = function() {
    return this.getMonthName().substring(0, 3);
};

// Gmail Label Utilities
var GMailLabelUtils = {
    getLabel: function(labelName) {
        return GmailApp.getUserLabelByName(labelName);
    },

    getOrCreateLabel: function(labelName) {
        var label = this.getLabel(labelName);
        if (!label) {
            label = GmailApp.createLabel(labelName);
        }
        return label;
    },

    getNestedLabels: function(parent, allLabels) { 
        var name = parent.getName() + '/';
        return allLabels.filter(function(label) {
            return label.getName().slice(0, name.length) == name;
        });
    },

    isLabelEmpty: function(label) {
        return label.getThreads(0, 1).length == 0;
    },

    isTreeEmpty: function(label, allLabels) {
        if (!this.isLabelEmpty(label))
            return false;

        var nested = this.getNestedLabels(label, allLabels);

        for(var j = 0; j < nested.length; j++){
            if (!this.isTreeEmpty(nested[j], allLabels))
                return false;
        }

        return true;
    },

    deleteEmptyLabels: function(config) {
        console.log("Starting label cleanup");

        var allLabels = GmailApp.getUserLabels();
        var filteredLabels = [];
        for (var i = 0; i < allLabels.length; i++) {
            var labelName = allLabels[i].getName();
            // Look at the label tree structure we want to cleanup
            if (labelName.startsWith("d/") && !labelName.startsWith("d/x") && !labelName.startsWith("d/t")) {
                console.log("Filtered label: " + labelName);
                filteredLabels.push(allLabels[i]);
            }
        }
        
        var emptyLabels = filteredLabels.filter(function(label){ 
            return GMailLabelUtils.isTreeEmpty(label, allLabels); 
        });

        for (var i = 0; i < emptyLabels.length; i++){
            var labelName = emptyLabels[i].getName();
            console.log('Deleting empty label ' + labelName);   
            
            if (config && !config.debug) {
                console.log("Deleted: " + emptyLabels[i].getName());
                emptyLabels[i].deleteLabel();
            } else {
                console.log("Would delete: " + emptyLabels[i].getName());
            }
        }

        console.log("Finished label cleanup");
    }
};

// Mail Utilities
const MailUtils = {
    sendEmail: function(debug, subject, bodyContent, emailAddress, sender) {
        if (!emailAddress) {
            console.error("Email address not configured");
            return;
        }

        if (debug) {
            subject = "[DEBUG] " + subject;
            console.log("Email subject: " + subject);
            console.log("Email sent to: " + emailAddress);
        }
      
        var body = Array.isArray(bodyContent) ? bodyContent.join('') : bodyContent;
        var options = {
            htmlBody: body,
            name: sender || "[Gmail Cleaner]"
        };

        try {
            GmailApp.sendEmail(emailAddress, subject, "Please view this email with HTML enabled", options);
        } catch (e) {
            console.error(`Error sending email: ${e}`);
        }
    },

    sendHtmlEmail: function(emailAddress, subject, htmlContent, options = {}) {
        if (!emailAddress) {
            console.error("Email address not configured");
            return false;
        }

        if (!htmlContent) {
            console.error("HTML content is required");
            return false;
        }

        // Default options
        var defaultOptions = {
            debug: false,
            sender: "[Gmail Cleaner]",
            plainTextFallback: "Please view this email with HTML enabled to see the full content.",
            attachments: [],
            replyTo: null,
            cc: null,
            bcc: null
        };

        // Merge provided options with defaults
        var emailOptions = Object.assign(defaultOptions, options);

        // Add debug prefix if in debug mode
        if (emailOptions.debug) {
            subject = "[DEBUG] " + subject;
            console.log("Email subject: " + subject);
            console.log("Email sent to: " + emailAddress);
            console.log("HTML content preview: " + htmlContent.substring(0, 200) + "...");
        }

        // Prepare Gmail API options
        var gmailOptions = {
            htmlBody: htmlContent,
            name: emailOptions.sender
        };

        // Add optional parameters if provided
        if (emailOptions.attachments && emailOptions.attachments.length > 0) {
            gmailOptions.attachments = emailOptions.attachments;
        }

        if (emailOptions.replyTo) {
            gmailOptions.replyTo = emailOptions.replyTo;
        }

        if (emailOptions.cc) {
            gmailOptions.cc = emailOptions.cc;
        }

        if (emailOptions.bcc) {
            gmailOptions.bcc = emailOptions.bcc;
        }

        try {
            GmailApp.sendEmail(emailAddress, subject, emailOptions.plainTextFallback, gmailOptions);
            
            if (emailOptions.debug) {
                console.log("HTML email sent successfully");
            }
            
            return true;
        } catch (e) {
            console.error(`Error sending HTML email: ${e}`);
            return false;
        }
    }
};

// Note: Label cleanup functions have been moved to GMailLabelUtils object
// Use GMailLabelUtils.deleteEmptyLabels(config) instead of deleteEmptyLabels()

// Configuration validation
function validateConfig(config) {
    var issues = [];

    if (!config.emailAddress && config.sendEmails) {
        issues.push("Email notifications enabled but no email address configured");
    }

    if (config.limit <= 0) {
        issues.push("Process limit must be greater than 0");
    }

    if (config.deleteBufferDays < 0) {
        issues.push("Delete buffer days must be non-negative");
    }

    const validCadences = ["daily", "weekly", "fortnight", "monthly", "yearly"];
    if (!validCadences.includes(config.cadence)) {
        issues.push(`Invalid cadence: ${config.cadence}. Must be one of: ${validCadences.join(", ")}`);
    }

    if (issues.length > 0) {
        console.error("Configuration issues found:");
        issues.forEach(issue => console.error("- " + issue));
        return false;
    }

    return true;
}

// Setup helper
function setupGmailCleaner(config) {
    if (!validateConfig(config)) {
        throw new Error("Invalid configuration. Please check the logs and fix the issues.");
    }

    // Create base labels
    GMailLabelUtils.getOrCreateLabel("d");
    GMailLabelUtils.getOrCreateLabel(config.auto_delete_label);
    GMailLabelUtils.getOrCreateLabel("d/t");

    // Create retention period labels
    config.filters.forEach(filter => {
        GMailLabelUtils.getOrCreateLabel(filter.label);
    });

    console.log("Initial setup completed successfully");
}

// Trigger creation helper
function createTriggers() {
    // Delete existing triggers
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
        ScriptApp.deleteTrigger(triggers[i]);
    }

    // Create daily trigger for tagging
    ScriptApp.newTrigger('GmailCleanerTagOnly')
        .timeBased()
        .everyDays(1)
        .atHour(1)  // 1 AM
        .create();

    // Create weekly trigger for deletion
    ScriptApp.newTrigger('GmailCleanerAutoDelete')
        .timeBased()
        .everyWeeks(1)
        .onWeekDay(ScriptApp.WeekDay.SUNDAY)
        .atHour(2)  // 2 AM
        .create();

    console.log("Triggers created successfully");
}


function findLabelsStartingWithX() {
  // Get all labels in the Gmail account
  var allLabels = GmailApp.getUserLabels();
  var xLabels = [];
  // Loop through all labels and check if they start with "X"
  for (var i = 0; i < allLabels.length; i++) {
    var label = allLabels[i].getName();
    if (label.startsWith("X")) {
      xLabels.push(label);
    }
  }
  // Log the labels starting with "X"
  Logger.log("Labels starting with 'X':");
  for (var j = 0; j < xLabels.length; j++) {
    Logger.log(xLabels[j]);
  }
}