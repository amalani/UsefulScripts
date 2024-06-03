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
  
  // Date.prototype.getMonthName = function() {
  //   let monthsArray = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  //   let month = new Date().getMonth();
  //   return monthsArray[month];
  // }
  