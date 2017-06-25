const regex_onlyDigits = /^\d+$/;
var profileName = '';
var loadingScreenDB = null;
var lsItems = new Array();
var prog = 0;
var total = 0;
var czip;
var fetchingProfile = false;
var itemsPerRequest = 350;
var startID = 0;
var moreItems = true;
var currentPage = 1;
var totalSize = 0;
//var itemQualitys = ['Standard', 'Inscribed', 'Auspicious', 'Genuine', 'Heroic', 'Frozen', 'Cursed', 'Autographed', 'Base', 'Corrupted', 'Unusual', 'Infused'];
$(document).ready(function () {
  $.getJSON('loadingscreens.json', function (data) {
    console.log(data.length + ' loading screens in database.');
    loadingScreenDB = {};
    $.each(data, function (lsNmbr, loadingscreen) {
      loadingScreenDB[loadingscreen.Name] = loadingscreen.ImageLink;
    });
    RandomizeBackground();
  });
  GetInventoryURL(true);
});

function RandomizeBackground() {
  var keys = Object.keys(loadingScreenDB);
  var index = Math.floor(keys.length * Math.random());
  var bgImgName = keys[index];
  var bgImg = new Image();
  bgImg.onload = function () {
    var bg = $('#background-image');
    console.log('Setting background image : ' + bgImg.src);
    bg.addClass('background-image')
    bg.css('background-image', 'url("' + bgImg.src + '")');
    $('.footerText').text('Background Image : ' + bgImgName);
  }
  bgImg.src = 'out/' + bgImgName + '.jpeg';
}

function GetInventoryURL(noError = false) {
  var dlBt = $('#downloadButton');
  dlBt.addClass('hide');
  var match = regex_onlyDigits.exec(profilelink.value);
  if (match == null) {
    if (!noError || profilelink.value != '') {
      $('#errors').html('<p>Invalid profile id. If you need help finding your SteamID64 you can checkout <a href="http://steamrep.com/">steamrep.com</a>.</p>')
    }
  } else {
    profileName = profilelink.value;
  }

  if (profileName != '') {
    profilelink.value = profileName;
    $('#errors').html('');
    dlBt.removeClass('hide');
  }
}


function GetLoadingScreens() {
  GetInventoryURL();
  if (profileName == '') {
    $('#errors').html('Empty or invalid profile id.');
  } else {
    var dlText = $('#downloadButtonText')
    dlText.text('Reading Steam inventory...');
    fetchingProfile = true;
    var fullProfileURL = '';
    var match = regex_onlyDigits.exec(profileName);
    if (match == null) {
      $('#errors').html('Empty or invalid profile id.');
    } else {
      fullProfileURL = 'https://crossorigin.me/https://steamcommunity.com/inventory/' + profileName + '/570/2?l=english&count=' + itemsPerRequest;
    }

    console.log(fullProfileURL);
    return ReadInventory(fullProfileURL);
  }
}

function ReadInventory(fullProfileURL) {
  var dlText = $('#downloadButtonText')
  var request = fullProfileURL + ((startID != 0) ? '&start_assetid=' + startID : '');
  return $.getJSON(request, function (data) {
    if (data.success == true) {
      // Get last item of page
      startID = data.hasOwnProperty('last_assetid') ? data.last_assetid : 0;
      moreItems = data.hasOwnProperty('more_items') && (data.more_items == 1);
      totalSize = data.hasOwnProperty('total_inventory_count') ? data.total_inventory_count : 0;

      if (totalSize > itemsPerRequest * 2) {
        $('#largeProfile').removeClass('hide');
        $('#largeProfile').text('This may take a few seconds. Items looked at :' + Math.min(totalSize, currentPage * itemsPerRequest) + '/' + totalSize);
      }

      $.each(data.descriptions, function (itemid, item) {
        var isLoadingScreen = false;
        var prefix = '';
        $.each(item.tags, function (tagid, tag) {
          if (tag.internal_name == 'loading_screen') {
            isLoadingScreen = true;
          } else if (tag.category == 'Quality' && tag.internal_name != 'unique') {
            prefix = tag.name;
          }
        });

        if (isLoadingScreen) {
          lsItems.push(item.name.substring(prefix.length));
        }
      });
    } else {
      $('#errors').html('Failed to load steam inventory. Check that your given profile name is correct and that your inventory is public.');
      dlText.text('Download your loading screens');
      fetchingProfile = false;
    }
  })
    .done(function () {
      if (moreItems) {
        ReadInventory(fullProfileURL).done(function () {
          console.log('Read page #' + (currentPage++));
        });
      } else {
        DownloadImages();
      }
    })
    .error(function (jqXHR, textStatus, errorThrown) {
      $('#errors').html('Failed to load steam inventory. Check that your given profile name is correct and that your inventory is public.');
      dlText.text('Download your loading screens');
      fetchingProfile = false;
      return false;
    })
}

function DownloadImages() {
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
      console.warn('Loading screen ' + ls + ' not in DB.');
      var errText = 'Loading screen ' + ls + ' not in DB.';
      $('#errors2').append('<p class="errors">' + errText + '</p>');
      prog++;
      return true;
    }

    loadImage('out/' + ls + '.jpeg', zip, ls);
  });
}

function StartDownload() {
  if (fetchingProfile) {
    return;
  }
  $('#downloadButton').disabled = true;
  GetLoadingScreens();
}

function loadImage(url, zip, name) {
  // Load image via XMLHttpRequest
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.responseType = 'arraybuffer';
  xhr.onerror = alert;
  xhr.onload = function () {
    if (xhr.status === 200) process(xhr.response, zip, name);
    else alert('Error:' + xhr.statusText);
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
  console.log(prog + '/' + total + ',' + (prog * 100.0 / total) + '%');
  if (prog == total) {
    czip = zip;
    dlBlob();
  }
}

function dlBlob() {
  czip.generateAsync({
    type: 'blob'
  }).
    then(function (content) {
      saveAs(content, 'loadingScreens.zip');
      $('#dlZipBt').removeClass('hide');
    })
}
