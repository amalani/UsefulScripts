// Rename this to Config

var Config = {
  emailAddress: 'your-email-address@gmail.com',
}

// Script Modes
const ScriptMode = {
    // Only tags the emails
    TAG_ONLY: 'tag_only',
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
