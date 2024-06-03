var MailUtils = {
    sendEmail: function(subject, body, to, prefix) {
      // body.push("<br><br>" + MailApp.getRemainingDailyQuota() + " more emails can be sent today.");
  
      if (this.config.debug) {
        console.log("Email subject: " + subject);
        console.log("Email sent to: " + to)
      }
      var message = {
        to: to,
        subject: "[gscript][" + prefix + "]: " + subject,
        htmlBody: body.join(""),
      };
      MailApp.sendEmail(message);
    }
}