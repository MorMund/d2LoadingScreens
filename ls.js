const regex_profileFull = /https?:\/\/steamcommunity\.com\/(id|profiles)\/(\w*)\/?/g;
const regex_onlyName = /^\w*$/;
const regex_onlyDigits = /^\d+$/;
var profileName = "";
var loadingScreenDB = null;
var lsItems = new Array();
var prog = 0;
var total = 0;
var czip;
var fetchingProfile = false;
//var itemQualitys = ["Standard", "Inscribed", "Auspicious", "Genuine", "Heroic", "Frozen", "Cursed", "Autographed", "Base", "Corrupted", "Unusual", "Infused"];
$(document).ready(function () {
  $.getJSON("loadingscreens.json", function (data) {
    console.log(data.length + " loading screens in database.");
    loadingScreenDB = {};
    $.each(data, function (lsNmbr, loadingscreen) {
      loadingScreenDB[loadingscreen.Name] = loadingscreen.ImageLink;
    });
    RandomizeBackground();
  });
  GetInventoryURL();
});

function RandomizeBackground() {
  var keys = Object.keys(loadingScreenDB);
  var index = Math.floor(keys.length * Math.random());
  var bgImgName = keys[index];
  var bgImg = new Image();
  bgImg.onload = function () {
    var bg = $('#background-image');
    console.log("Setting background image : " + bgImg.src);
    bg.addClass("background-image")
    bg.css("background-image", 'url("' + bgImg.src + '")');
    $(".footerText").text("Background Image : " + bgImgName);
  }
  bgImg.src = 'out/' + bgImgName + '.jpeg';
}

function GetInventoryURL(noError = true) {
  var dlBt = $('#downloadButton');
  dlBt.addClass("hide");
  var match = regex_profileFull.exec(profilelink.value);
  if (match == null) {
    match = regex_onlyName.exec(profilelink.value);
    if (match == null) {
      if (!noError) {
        errors.innerHTML = 'Invalid profile name or link.';
      }

      profileName = '';
    } else {
      profileName = match[0];
    }
  } else {
    profileName = match[2];
  }

  if (profileName == '') {
    if (!noError) {
      errors.innerHTML = 'Empty or invalid profile name.';
    }
  } else {
    profilelink.value = profileName;
    errors.innerHTML = null;
    dlBt.removeClass('hide');
  }
}


function GetLoadingScreens() {
  GetInventoryURL();
  if (profileName == "") {
    errors.innerHTML = "Empty or invalid profile name.";
  } else {
    var dlText = $("#downloadButtonText")
    dlText.text("Reading Steam inventory...");
    fetchingProfile = true;
    var fullProfileURL = "";
    var match = regex_onlyDigits.exec(profileName);
    if (match == null) {
      fullProfileURL = "https://crossorigin.me/https://steamcommunity.com/id/" + profileName + "/inventory/json/570/2.json";
    } else {
      fullProfileURL = "https://crossorigin.me/https://steamcommunity.com/inventory/" + profileName + "/570/2";
    }

    console.log(fullProfileURL);
    return $.getJSON(fullProfileURL, function (data) {
      if (data.success == true) {
        $.each(match == null ? data.rgDescriptions : data.descriptions, function (itemid, item) {
          var isLoadingScreen = false;
          var prefix = "";
          $.each(item.tags, function (tagid, tag) {
            if (tag.internal_name == "loading_screen") {
              isLoadingScreen = true;
            } else if (tag.category == "Quality" && tag.internal_name != "unique") {
              prefix = tag.name;
            }
          });

          if (isLoadingScreen) {
            lsItems.push(item.name.substring(prefix.length));
          }
        });
      } else {
        errors.innerHTML = "Failed to load steam inventory. Check that your given profile name is correct and that your profile is public.";
        dlText.text("Download your loading screens");
        fetchingProfile = false;
      }
    })
      .error(function () {
        errors.innerHTML = "Failed to load steam inventory. Check that your given profile name is correct and that your profile is public.";
        dlText.text("Download your loading screens");
        fetchingProfile = false;
        return false;
      });
  }
}

function StartDownload() {
  if (fetchingProfile) {
    return;
  }
  $('#downloadButton').disabled = true;
  GetLoadingScreens().done(function () {
    if (!lsItems || lsItems.length == 0) {
      $('#downloadButton').disabled = false;
      return;
    }

    $('#downloadsetup').addClass('hide');
    $('#dowloadprogress').removeClass('hide');
    prog = 0;
    total = lsItems.length;
    var progBar = $('#progress');
    progBar.attr('aria-valuemax', total).attr('aria-valuemin', 0).attr('aria-valuenow', 0).css('width', '0%');
    var zip = new JSZip();
    $.each(lsItems, function (i, ls) {
      if (!(ls in loadingScreenDB)) {
        console.warn("Loading screen " + ls + " not in DB.");
        var errText = "Loading screen " + ls + " not in DB.";
        $("#errors2").append('<p class="errors">' + errText + '</p>');
        prog++;
        return true;
      }

      loadImage('out/' + ls + '.jpeg', zip, ls);
    });
  });
}

function loadImage(url, zip, name) {
  // Load image via XMLHttpRequest
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url);
  xhr.responseType = "arraybuffer";
  xhr.onerror = alert;
  xhr.onload = function () {
    if (xhr.status === 200) process(xhr.response, zip, name);
    else alert("Error:" + xhr.statusText);
  };
  xhr.send();
}

function process(buffer, zip, name) {
  var view = new Uint8Array(buffer);
  zip.file(name + '.jpeg', view, {
    binary: true
  });

  var progBar = $('#progress');
  prog++;
  progBar.attr('aria-valuenow', prog).css('width', (prog * 100.0 / total) + '%');
  progBar.html(prog + '/' + total);
  console.log(prog + '/' + total + "," + (prog * 100.0 / total) + '%');
  if (prog == total) {
    czip = zip;
    dlBlob();
  }
}

function dlBlob() {
  czip.generateAsync({
    type: "blob"
  }).
    then(function (content) {
      saveAs(content, "loadingScreens.zip");
      $("#dlZipBt").removeClass("hide");
    })
}
