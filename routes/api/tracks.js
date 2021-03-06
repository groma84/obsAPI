var router = require('express').Router();
var mongoose = require('mongoose');
var TrackData = mongoose.model('TrackData');
var Track = mongoose.model('Track');
var Comment = mongoose.model('Comment');
var User = mongoose.model('User');
var auth = require('../auth');
var currentTracks = new Map();
class trackInfo {
  constructor (track,trackData)
  {
    this.track = track;
    this.trackData = trackData;
  }
}


function addPointsToTrack(track,body)
{
  var num = 0;
  var start = 0;
  var end = 0;
 //console.log("len"+body.length);
  while (end < body.length) {
    start = end;
    while (body[end] != ";" && body[end] != "$" && end < body.length) {
      end++;
    }
    if(body[end] == "$") // $ is replacing \n as newlines are not allowed in json strings
    {
        num=0;
    }
    if(end < body.length)
    {
    var token = body.substr(start, end - start);
    end++;
    if(token.length>0)
    {
    //console.log(token);
    //console.log("num:"+num);
    //console.log("end:"+end);
    
    if((num == 0) && (token == "Date"))
    {
      // we have a header line, ignore it for now, TODO parse it
      if (end < body.length) {
        while (body[end] != ";" && body[end] != "$" && end < body.length) {
          end++;
        }
        start = end;
        num=100;
      }
    }
    if (num == 0) {
      track.trackData.points.push({ date: "dummy", time: "", latitude: "", longitude: "", course: "", speed: "", d1: "", d2: "", flag: "", private: ""});
      track.trackData.points[track.trackData.points.length - 1].date = token;
      num++;
    }
    else if (num == 1) {
      track.trackData.points[track.trackData.points.length - 1].time = token;
      num++;
    }
    else if (num == 2) {
      var f = parseFloat(token);
      if(isNaN(f))
      {
          f = parseFloat(token.substring(0,10));
      }
      if(isNaN(f))
      {
        f=0.0;
      }
      track.trackData.points[track.trackData.points.length - 1].latitude = f;
      num++;
    }
    else if (num == 3) {
      var f = parseFloat(token);
      if(isNaN(f))
      {
          f = parseFloat(token.substring(0,10));
      }
      if(isNaN(f))
      {
        f=0.0;
      }
      track.trackData.points[track.trackData.points.length - 1].longitude = f;
      num++;
    }
    else if (num == 4) {
      var f = parseFloat(token);
      if(isNaN(f))
      {
          f = parseFloat(token.substring(0,10));
      }
      if(isNaN(f))
      {
        f=0.0;
      }
      track.trackData.points[track.trackData.points.length - 1].course = f;
      num++;
    }
    else if (num == 5) {
      var f = parseFloat(token);
      if(isNaN(f))
      {
          f = parseFloat(token.substring(0,10));
      }
      if(isNaN(f))
      {
        f=0.0;
      }
      track.trackData.points[track.trackData.points.length - 1].speed = f;
      num++;
    }
    else if (num == 6) {
      track.trackData.points[track.trackData.points.length - 1].d1 = token;
      num++;
    }
    else if (num == 7) {
      track.trackData.points[track.trackData.points.length - 1].d2 = token;
      num++;
    }
    else if (num == 8) {
      track.trackData.points[track.trackData.points.length - 1].flag = token;
      num++;
    }
    else if (num == 9) {
      track.trackData.points[track.trackData.points.length - 1].private = token;
      num++;
    }
    }
    }
  }
}

// Preload track objects on routes with ':track'
router.param('track', function(req, res, next, slug) {
  Track.findOne({ slug: slug})
    .populate('author')
    .then(function (track) {
      if (!track) { return res.sendStatus(404); }

      req.track = track;

      return next();
    }).catch(next);
});

router.param('comment', function(req, res, next, id) {
  Comment.findById(id).then(function(comment){
    if(!comment) { return res.sendStatus(404); }

    req.comment = comment;

    return next();
  }).catch(next);
});

router.get('/', auth.optional, function(req, res, next) {
  var query = {};
  var limit = 20;
  var offset = 0;

  if(typeof req.query.limit !== 'undefined'){
    limit = req.query.limit;
  }

  if(typeof req.query.offset !== 'undefined'){
    offset = req.query.offset;
  }

  if( typeof req.query.tag !== 'undefined' ){
    query.tagList = {"$in" : [req.query.tag]};
  }

  Promise.all([
    req.query.author ? User.findOne({username: req.query.author}) : null,
    req.query.favorited ? User.findOne({username: req.query.favorited}) : null
  ]).then(function(results){
    var author = results[0];
    var favoriter = results[1];

    if(author){
      query.author = author._id;
    }

    if(favoriter){
      query._id = {$in: favoriter.favorites};
    } else if(req.query.favorited){
      query._id = {$in: []};
    }

    return Promise.all([
      Track.find(query)
        .limit(Number(limit))
        .skip(Number(offset))
        .sort({createdAt: 'desc'})
        .populate('author')
        .where('visible').equals(true)
        .exec(),
      Track.countDocuments(query).exec(),
      req.payload ? User.findById(req.payload.id) : null,
    ]).then(function(results){
      var tracks = results[0];
      var tracksCount = results[1];
      var user = results[2];
      //console.log(tracks);
      var retTracks = [];
      for (t of tracks) {
        //console.log(t);
        //if (t.author.areTracksVisibleForAll || t.author == user) {
          retTracks.push(t);
        //}
      }
      return res.json({
        tracks: retTracks.map(function(track){
             return track.toJSONFor(user);
        }),
        tracksCount: retTracks.length
      });
    });
  }).catch(next);
});

router.get('/feed', auth.required, function(req, res, next) {
  var limit = 20;
  var offset = 0;

  if(typeof req.query.limit !== 'undefined'){
    limit = req.query.limit;
  }

  if(typeof req.query.offset !== 'undefined'){
    offset = req.query.offset;
  }

  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }
    if(user.following != '')
    {
    Promise.all([
      Track.find({ author: {$in: user.following}})
        .limit(Number(limit))
        .skip(Number(offset))
        .populate('author')
        .exec(),
      Track.countDocuments({ author: {$in: user.following}})
    ]).then(function(results){
      var tracks = results[0];
      var tracksCount = results[1];

      return res.json({
        tracks: tracks.map(function(track){
          return track.toJSONFor(user);
        }),
        tracksCount: tracksCount
      });
    }).catch(next);
    }
    else
    {
    Promise.all([
      Track.find({ author: {$in: req.payload.id}})
        .limit(Number(limit))
        .skip(Number(offset))
        .populate('author')
        .exec(),
      Track.countDocuments({ author: {$in: req.payload.id}})
    ]).then(function(results){
      var tracks = results[0];
      var tracksCount = results[1];

      return res.json({
        tracks: tracks.map(function(track){
          return track.toJSONFor(user);
        }),
        tracksCount: tracksCount
      });
    }).catch(next);
    }



  });
});

router.post('/', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    var track = new Track(req.body.track);
    var trackData = new TrackData();
    track.trackData = trackData._id;
     
    track.author = user;
    track.visible = track.author.areTracksVisibleForAll;
    trackData.save(function (err){
    if(err){
      console.log("failed to save trackData");
    }
    });

    return track.save().then(function(){
      //console.log(track.author);
      return res.json({track: track.toJSONFor(user)});
    });
    return res.json({track: track.toJSONFor(user)});
  }).catch(next);
});

router.post('/add', auth.optional, function(req, res, next) {
  //console.log("Add");

  //console.log(req.payload);
  User.findById(req.body.id).then(function (user) {
    if (!user) { return res.sendStatus(401); }

    var ti = null;
    if (currentTracks.has(req.body.id))
      ti = currentTracks.get(req.body.id);
      
    //console.log("TI" + ti);
    //console.log("TILen" + ti.trackData.points.length);
    //console.log("TITrack" + ti.track);
    //console.log("Body" + req.body.track.body);
    if (ti.track) {
      addPointsToTrack(ti, req.body.track.body);
      //console.log("TLen" + ti.trackData.points.length);
      ti.track.author = user;
    }

    //return track.save().then(function(){
    //  console.log(track.author);
    //return res.json({ track: track.toJSONFor(user) });
      return res.sendStatus(200);
    //});
  }).catch(next);
});

router.post('/begin', auth.optional, function (req, res, next) {
  //console.log("Begin");
  //console.log(req.payload);
  User.findById(req.body.id).then(function (user) {
    if (!user) { return res.sendStatus(401); }

    if(currentTracks.has(req.body.id))
        currentTracks.delete(req.body.id); // delete old parts if there are leftovers
    var ti = new trackInfo(new Track(req.body.track),new TrackData());
    ti.track.trackData = ti.trackData._id; 
    currentTracks.set(req.body.id, ti);

  //console.log("addToTrack"+req.body);
    
    addPointsToTrack(ti, ti.track.body);

      //console.log("TLen" + ti.track);
      //console.log("TLen" + ti.trackData);
    //console.log("TLen" + ti.trackData.points.length);

    //console.log(track.trackData.points[0].date);
    ti.track.author = user;

    //return track.save().then(function () {
    //  console.log(track.author);
      return res.sendStatus(200);
    //});
  }).catch(next);
});

router.post('/end', auth.optional, function (req, res, next) {
  //console.log("End");
  //console.log(req.payload);
  User.findById(req.body.id).then(function (user) {
    if (!user) { return res.sendStatus(401); }

    var track = null;
    if (currentTracks.has(req.body.id))
    {
      ti = currentTracks.get(req.body.id);
      addPointsToTrack(ti, req.body.track.body);
    }
    else
    {
      var ti = new trackInfo(new Track(req.body.track),new TrackData());
      ti.track.trackData = ti.trackData._id;
      addPointsToTrack(ti, ti.track.body);
    }
    if (ti.track) {
      ti.track.author = user;
    }

    currentTracks.delete(req.body.id); // we are done with this track, it is complete
    ti.track.author = user;

      //console.log(track);
      //console.log("user:"+user);
    return ti.track.save().then(function () {
      //console.log("TLen" + ti.track);
      //console.log("TLen" + ti.trackData);
      //console.log("TLen" + ti.trackData.points.length);
    ti.trackData.save(function (err){
    if(err){
      console.log("failed to save trackData"+err.toString());
    }
      });

      console.log("successfulSave:");
      return res.sendStatus(200);
    });
  }).catch(next);
});

// return a track
router.get('/:track', auth.optional, function(req, res, next) {
  Promise.all([
    req.payload ? User.findById(req.payload.id) : null,
    req.track.populate('author').execPopulate()
  ]).then(function(results){
    var user = results[0];

    return res.json({track: req.track.toJSONFor(user)});
  }).catch(next);
});

// update track
router.put('/:track', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if(req.track.author._id.toString() === req.payload.id.toString()){
      if(typeof req.body.track.title !== 'undefined'){
        req.track.title = req.body.track.title;
      }

      if(typeof req.body.track.description !== 'undefined'){
        req.track.description = req.body.track.description;
      }

      if(typeof req.body.track.body !== 'undefined'){
        req.track.body = req.body.track.body;
      }

      if(typeof req.body.track.tagList !== 'undefined'){
        req.track.tagList = req.body.track.tagList;
      }
      req.track.visible = req.body.track.visible;
      console.log("saving track");

      req.track.save().then(function(track){
        return res.json({track: track.toJSONFor(user)});
      }).catch(next);
    } else {
      return res.sendStatus(403);
    }
  });
});

// delete track
router.delete('/:track', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }
    if(req.track.author._id.toString() === req.payload.id.toString()){
      TrackData.findByIdAndDelete(req.track.trackData, function (err, td) {console.log("doneDelete");}); // delet our track data
      return req.track.remove().then(function(){
        return res.sendStatus(204);
      });
    } else {
      return res.sendStatus(403);
    }
  }).catch(next);
});

// Favorite an track
router.post('/:track/favorite', auth.required, function(req, res, next) {
  var trackId = req.track._id;

  User.findById(req.payload.id).then(function(user){
    if (!user) { return res.sendStatus(401); }

    return user.favorite(trackId).then(function(){
      return req.track.updateFavoriteCount().then(function(track){
        return res.json({track: track.toJSONFor(user)});
      });
    });
  }).catch(next);
});

// Unfavorite an track
router.delete('/:track/favorite', auth.required, function(req, res, next) {
  var trackId = req.track._id;

  User.findById(req.payload.id).then(function (user){
    if (!user) { return res.sendStatus(401); }

    return user.unfavorite(trackId).then(function(){
      return req.track.updateFavoriteCount().then(function(track){
        return res.json({track: track.toJSONFor(user)});
      });
    });
  }).catch(next);
});

// return an track's comments
router.get('/:track/comments', auth.optional, function(req, res, next){
  Promise.resolve(req.payload ? User.findById(req.payload.id) : null).then(function(user){
    return req.track.populate({
      path: 'comments',
      populate: {
        path: 'author'
      },
      options: {
        sort: {
          createdAt: 'desc'
        }
      }
    }).execPopulate().then(function(track) {
      return res.json({comments: req.track.comments.map(function(comment){
        return comment.toJSONFor(user);
      })});
    });
  }).catch(next);
});

// create a new comment
router.post('/:track/comments', auth.required, function(req, res, next) {
  User.findById(req.payload.id).then(function(user){
    if(!user){ return res.sendStatus(401); }

    var comment = new Comment(req.body.comment);
    comment.track = req.track;
    comment.author = user;

    return comment.save().then(function(){
      req.track.comments.push(comment);

      return req.track.save().then(function(track) {
        res.json({comment: comment.toJSONFor(user)});
      });
    });
  }).catch(next);
});

router.delete('/:track/comments/:comment', auth.required, function(req, res, next) {
  if(req.comment.author.toString() === req.payload.id.toString()){
    req.track.comments.remove(req.comment._id);
    req.track.save()
      .then(Comment.find({_id: req.comment._id}).remove().exec())
      .then(function(){
        res.sendStatus(204);
      });
  } else {
    res.sendStatus(403);
  }
});

// return an track's trackData
router.get('/:track/TrackData', auth.optional, function(req, res, next){
  Promise.resolve(req.payload ? User.findById(req.payload.id) : null).then(function(user){
    //console.log("requestTrackData"+req.track);
    TrackData.findById(req.track.trackData,function(err,trackData){
      //console.log({trackData: trackData});
      return res.json({trackData: trackData});
    });
  }).catch(next);
});

module.exports = router;
