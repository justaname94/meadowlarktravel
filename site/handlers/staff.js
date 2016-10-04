var staff = {
  mitch: { bio: 'Mitch is the man to have at your back in a bar fight.' },
  madeline: { bio:'Madeline is our Oregon expert.' },
  walt: { bio: 'Walt is our Oregon Coast expert.' }
};

exports.staff = function(req, res) {
  var context = {};
  var staffInfo = [];
  for (var staffMember in staff) {
  	var member = staff[staffMember];
  	member.name = staffMember;
  	staffInfo.push(member);
  }
  context.staff = staffInfo;

  res.render('staff', context);
};

exports.staff_name = function(req, res, next) {
  var info = staff[req.params.name];
  if(!info) {
    return next(); // will eventually fall through to 404
  }
  res.render('staffer', info);
};

