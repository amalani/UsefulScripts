var GMailLabelUtils = {
    getLabel: function(labelName) {
      return GmailApp.getUserLabelByName(labelName);
    }
  
    ,getOrCreateLabel: function(labelName) {
      var label = this.getLabel(labelName);
      if (!label) {
        label = GmailApp.createLabel(labelName);
      }
      return label;
    }
}