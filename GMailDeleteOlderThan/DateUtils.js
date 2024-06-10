
var DateUtils = {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
}

Date.prototype.getMonthName = function() {
    return DateUtils.monthNames[this.getMonth()];
}
  
Date.prototype.getShortMonthName = function() {
    return this.getMonthName().substring(0, 3);
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


Date.prototype.getWeekNumber = function() {
    let janFirst = new Date(this.getFullYear(), 0, 1);
    let numberOfDays = Math.floor((this - janFirst) / (24 * 60 * 60 * 1000));
    return Math.ceil((dt.getDay() + 1 + numberOfDays) / 7);
}
