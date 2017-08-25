const regex_steamid64 = /^\d{17}$/;
const aws = 'https://yvnln1tmk5.execute-api.us-east-2.amazonaws.com/';
const awsStage = 'prod';
var profileName = '';
var loadingScreenDB = null;
var lsItems = new Array();
var prog = 0;
var total = 0;
var czip;
var fetchingProfile = false;
var itemsPerRequest = 500;
var startID = 0;
var moreItems = true;
var currentPage = 1;
var totalSize = 0;

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
        bg.addClass('background-image');
        bg.css('background-image', 'url("' + bgImg.src + '")');
        $('#bgInfo').text('Background Image: ' + bgImgName);
    };

    bgImg.src = 'out/' + bgImgName + '.jpeg';
}

function GetInventoryURL() {
    var dlBt = $('#downloadButton');
    dlBt.addClass('hide');
    var inputVal = $('#profilelink').val();
    if (inputVal === '')
        return;
    profileName = '';
    var id64match = regex_steamid64.exec(inputVal);
    if (id64match !== null) {
        profileName = inputVal;
        ValidateProfileLink();
    } else {
        GetSteam64(
            inputVal,
            function (steamid) {
                profileName = steamid;
                ValidateProfileLink();
            });
    }
}

function ValidateProfileLink() {
    $('#processSteamId').addClass('hide');
    if (profileName !== '') {
        $('#profilelink').val(profileName);
        $('#errors').html('');
        $('#downloadButton').removeClass('hide');
    } else {
        $('#errors').html('Invalid profile id.');
    }
}

function GetSteam64(accName, callback) {
    $('#processSteamId').removeClass('hide');
    $.getJSON(aws + awsStage + '/steamid?user=' + accName, function (data) {
        if (data.response.success === 1) {
            callback(data.response.steamid);
        } else {
            callback('');
        }
    })
        .error(function (jqXHR, textStatus, errorThrown) {
            callback('');
        });
}

function GetLoadingScreens() {
    GetInventoryURL();
    if (profileName === '') {
        $('#errors').html('Empty or invalid profile id.');
    } else {
        var dlText = $('#downloadButtonText');
        dlText.text('Reading Steam inventory...');
        fetchingProfile = true;
        var fullProfileURL = '';
        var match = regex_steamid64.exec(profileName);
        if (match === null) {
            $('#errors').html('Empty or invalid profile id.');
        } else {
            fullProfileURL = aws + awsStage + '/' + profileName + '/570/2?l=english&count=' + itemsPerRequest;
        }

        console.log(fullProfileURL);
        return ReadInventory(fullProfileURL);
    }
}

function ReadInventory(fullProfileURL) {
    var dlText = $('#downloadButtonText');
    var request = fullProfileURL + (startID !== 0 ? '&start_assetid=' + startID : '');
    return $.getJSON(request, function (data) {
        if (data.success === 1) {
            // Get last item of page
            startID = data.hasOwnProperty('last_assetid') ? data.last_assetid : 0;
            moreItems = data.hasOwnProperty('more_items') && data.more_items === 1;
            totalSize = data.hasOwnProperty('total_inventory_count') ? data.total_inventory_count : 0;

            if (totalSize > itemsPerRequest * 2) {
                $('#largeProfile').removeClass('hide');
                $('#largeProfile').text('This may take a few seconds. Items looked at: ' + Math.min(totalSize, currentPage * itemsPerRequest) + '/' + totalSize);
            }

            $.each(data.descriptions, function (itemid, item) {
                var isLoadingScreen = false;
                var prefix = '';
                $.each(item.tags, function (tagid, tag) {
                    if (tag.internal_name === 'loading_screen') {
                        isLoadingScreen = true;
                    }

                    if (tag.category === 'Quality' && tag.internal_name !== 'unique') {
                        prefix = tag.localized_tag_name;
                    }
                });

                if (isLoadingScreen) {
                    if (prefix === '') {
                        lsItems.push(item.name);
                    } else {
                        lsItems.push(item.name.substring(prefix.length + 1));
                    }

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
                console.log('Read page #' + currentPage++ + ' ' + request);
                ReadInventory(fullProfileURL).done(function () {
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
        });
}

function DownloadImages() {
    if (!lsItems || lsItems.length === 0) {
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
    progBar.attr('aria-valuenow', prog).css('width', prog * 100.0 / total + '%');
    progBar.html(prog + '/' + total);
    console.log(prog + '/' + total + ',' + prog * 100.0 / total + '%');
    if (prog === total) {
        czip = zip;
        dlBlob();
    }
}

function dlBlob() {
    czip.generateAsync({
        type: 'blob'
    })
        .then(function (content) {
            saveAs(content, 'loadingScreens.zip');
            $('#dlZipBt').removeClass('hide');
        });
}
