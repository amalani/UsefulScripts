
var DateUtils = {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
}

Date.prototype.addDays = function (days) {
    const date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
};

Date.prototype.getLastSunday = function () {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() - date.getDay());
    return date;
}

Date.prototype.getMonthName = function() {
    return DateUtils.monthNames[this.getMonth()];
}
  
Date.prototype.getShortMonthName = function() {
    return this.getMonthName().substring(0, 3);
}
  