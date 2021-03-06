﻿var bostadroid = {};

bostadroid.target = 'http://labs.joakimhedlund.com/bostadroid/server/index.php';
if(window.device) bostadroid.target = 'http://bostadroid.joakimhedlund.com/server/index.php';
bostadroid.store = {};

bostadroid.error = (function(message){
	alert(message);
	if(!window.device) console.log(message);
});
bostadroid.pad = (function(n, c){
	if ((n = n + '').length < c) {
	    return new Array((++c) - n.length).join('0') + n;
	}
	return n;
});
bostadroid.loadstore = (function(){
	//load stored cache
	if(localStorage.getItem("store")){
		bostadroid.store = localStorage.getItem("store");
		bostadroid.store = JSON.parse(bostadroid.store);
		//now clear old houses (7 days) and re-save
		var nowstamp = Math.round((new Date()).getTime() / 1000);
		var weekoldstamp = (nowstamp-604800);
		var savelist = false;
		for (var h in bostadroid.store.houses){
			if(weekoldstamp > bostadroid.store.houses[h].cachetime){
				delete bostadroid.store.houses[h];
				savelist = true;
			}
		}
		if(savelist == true) bostadroid.savestore();
	}else{
		bostadroid.store.houses = {};
	}
});
bostadroid.savestore = (function(){
	localStorage.setItem("store", JSON.stringify(bostadroid.store));
});
bostadroid.loadsettings = (function(){
	jQuery("#pagesettings input").each(function(){
		var settingname = jQuery(this).attr('name');
		var fromstorage = localStorage.getItem(settingname);
		//if its not saved to storage we want to use default settings, ergo no change
		if(fromstorage !== null){	
			if(fromstorage === true){
				jQuery(this).attr('checked', 'checked');
			}else{
				jQuery(this).removeAttr('checked');
			}
		}
	});
	
	//now deal with changed values
	bostadroid.updatesettings();
});
bostadroid.savesetting = (function(param){
	var settingname = jQuery(param).attr('name');
	localStorage.setItem(settingname, jQuery(param).is(':checked'));
	
	//now deal with changed values
	bostadroid.updatesettings();
});
bostadroid.updatesettings = (function(){
	
	//Show Google Maps?
	if(jQuery("#setting-gmap").is(":checked") === false){
		jQuery("#pagedynamic .house .map").attr("src", "data:image/gif;base64,R0lGODlhAQABAPABAP///wAAACH5BAEKAAAALAAAAAABAAEAAAICRAEAOw%3D%3D");
	}
});

bostadroid.showlogin = (function(manuallogout){
	//show a message
	if(!manuallogout) bostadroid.error('Du har blivit utloggad pga inaktivitet, var god logga in igen.');
	//clear some user info depending on settings
	var rememberme = jQuery("#rememberme:checked").length;
	if(bostadroid.store.username == jQuery("#ajaxusr").val() && !rememberme){
		delete bostadroid.store.username;
		delete bostadroid.store.password;
		delete bostadroid.store.remember;
		bostadroid.savestore();
	}
	if(!rememberme) jQuery("#ajaxpwd").val("");
	//show login
	jQuery.mobile.changePage(jQuery("#pagelogin"));
	//TODO: clear history to prevent back-button
	
});

bostadroid.login = (function(){
	jQuery.mobile.showPageLoadingMsg();
	jQuery.ajax({
		url: bostadroid.target,
		type: "POST",
		data: jQuery("#pagelogin input").serialize(),
		dataType: 'json',
		success: function(response){
			jQuery.mobile.hidePageLoadingMsg();
			if(response.status != 200){
				bostadroid.error(response.message);
			}else{
				//ok we are logged in, now update dashboard
				jQuery("#pagedashboard div[data-role=content] li .membersince").text(response.data.membersince);
				jQuery("#pagedashboard div[data-role=content] li .customerid").text(response.data.customerid);
				jQuery("#pagedashboard div[data-role=content] li .email").text(response.data.email);
				jQuery("#pagedashboard div[data-role=content] li .income").text(response.data.income);
				
				//look for warning/notification/other message
				jQuery('#pagedashboard .infomessage').remove();
				if(response.data.infomessage) jQuery('#pagedashboard [data-role="content"]').prepend('<div class="ui-bar ui-bar-e infomessage">'+ response.data.infomessage +'</div>');
				
				//build houses
				var x = 0;
				jQuery("#pagedashboard ul.houses").html('');
				while(response.data.houses.length > x){
					//
					jQuery("#pagedashboard ul.houses").append('<li class="house"><a href="#pagedynamic" data-houseid="'+ response.data.houses[x].id +'" data-houselink="'+ response.data.houses[x].link +'"><span class="area">'+ response.data.houses[x].area +',</span>'+ response.data.houses[x].street +' <span class="ui-li-count">'+ response.data.houses[x].rank +'</span></a></li>');
					x++;
				}
				if(response.data.houses.length == 0) jQuery("#pagedashboard ul.houses").html('<li>Här var det tomt!</li>');
				
				//...and redirect
				jQuery.mobile.changePage(jQuery("#pagedashboard"));
				
				//rebuild style
				jQuery("#pagedashboard ul.houses").listview('refresh');
			}
		},
		error: function(jqXHR, textStatus, errorThrown){
			jQuery.mobile.hidePageLoadingMsg();
			bostadroid.error("Kunde inte kontakta servern.");
		}
	  });
});

bostadroid.search = (function(){
	var qualified = false; //TODO: bostadroid+ lägenheter man kan söka?
	
	
	function showhouselist(response){
		//look for warning/notification/other message
		jQuery('#pagesearch .infomessage').remove();
		if(response.data.infomessage) jQuery('#pagesearch [data-role="content"]').prepend('<div class="ui-bar ui-bar-e infomessage">'+ response.data.infomessage +'</div>');
		
		//we got a response, fill the list with data
		var x = 0;
		//somewhere to store the place in queue and the tags
		var queuestring = '';
		var tags = '';
		//empty the list before adding to it
		jQuery("#pagesearch ul.houses").html('');
		while(response.data.houses.length > x){
			//have we cached this house? OR we have tags
			if(response.data.houses[x].tags){ //tags is not set when we retrieve list from cache
				for(var t=0; t<response.data.houses[x].tags.length; t++) {
					tags = tags + response.data.houses[x].tags[t] + ' ';
				}
			}
			if(bostadroid.store.houses[response.data.houses[x].id]){
				if(bostadroid.store.houses[response.data.houses[x].id].rank.indexOf("projektlägenheter") != -1){
					queuestring = tags + "P";
				}else{
					queuestring = tags + bostadroid.store.houses[response.data.houses[x].id].rank;
				}
			}else{
				queuestring = tags;
			}
			queuestring = (queuestring.length > 0 ? '<span class="ui-li-count">'+ queuestring +'</span>' : '');
			//reset tags because they have been printed
			tags = '';
			//build list
			jQuery("#pagesearch ul.houses").append('<li class="house" id="search-house-'+ response.data.houses[x].id +'"><a href="#pagedynamic" data-houseid="'+ response.data.houses[x].id +'" data-houselink="'+ response.data.houses[x].link +'"><span class="area">'+ response.data.houses[x].area +',</span>'+ response.data.houses[x].street + queuestring + '</a></li>');
			x++;
		}
		if(response.data.houses.length == 0) jQuery("#pagesearch ul.houses").html('<li>Hittade inga lägenheter</li>');
		jQuery("#pagesearch ul.houses").listview('refresh');
	}
	
	if(bostadroid.sessionhouselist){
		showhouselist(bostadroid.sessionhouselist);
	}else{
		jQuery.mobile.showPageLoadingMsg();
		jQuery.ajax({
			url: bostadroid.target,
			type: "POST",
			data: {"action": "list", "qualifiedonly": qualified},
			dataType: 'json',
			success: function(response){
				jQuery.mobile.hidePageLoadingMsg();
				if(response.status != 200){
					if(response.status == 401){
						bostadroid.showlogin();
					}else{
						bostadroid.error(response.message);
					}
				}else{
					showhouselist(response);
					
					//cache data
					bostadroid.sessionhouselist = response;
				}
			},
			error: function(jqXHR, textStatus, errorThrown){
				jQuery.mobile.hidePageLoadingMsg();
				
				var cacheExists = false;
				if(Object.keys(bostadroid.store.houses).length > 0) cacheExists = true;
				
				if(cacheExists){
					//convert object to array for showhouselist()
					bostadroid.sessionhouselist = {data: {houses: []}}
					var x = 0;
					jQuery.each(bostadroid.store.houses, function(){
						bostadroid.sessionhouselist.data.houses[x] = this;
						x++;
					});
					
					//aaaaand show it.
					bostadroid.error("Kunde inte kontakta servern, visar cachad lista");
					showhouselist(bostadroid.sessionhouselist);
				}else{
					bostadroid.error("Kunde inte kontakta servern.");
				}
			}
		});
	}
});

bostadroid.house = (function(linkelement){
	jQuery.mobile.showPageLoadingMsg();
	
	var houselink = jQuery(linkelement).attr("data-houselink");
	var houseid = jQuery(linkelement).attr("data-houseid");
	
	function buildHouse(data){
		//look for warning/notification/other message
		jQuery('#pagedynamic .infomessage').remove();
		if(data.infomessage) jQuery('#pagedynamic [data-role="content"]').prepend('<div class="ui-bar ui-bar-e infomessage">'+ data.infomessage +'</div>');
		
		//title (adress)
		jQuery("#pagedynamic .house>h2").text(data.street +',');
		jQuery("#pagedynamic .house>h4").text(data.area);
		
		//image width?
		var housewidth = jQuery("#pagedynamic .house").width();
		//image url
		var mapurl = 'http://maps.googleapis.com/maps/api/staticmap?center='+ encodeURIComponent(data.street) +'+'+ encodeURIComponent(data.area) +'&zoom=12&size='+ housewidth +'x250&maptype=roadmap&sensor=false&markers=size:mid|color:red|'+ encodeURIComponent(data.street) +'+'+ encodeURIComponent(data.area);
		//update src attribute, browser will do the rest
		if(jQuery("#setting-gmap").is(":checked")) jQuery("#pagedynamic .house .map").attr("src", mapurl);
		
		var project = false;
		if(data.rank.length === 0){
			jQuery("#pagedynamic .house .details .rank").text('Okänd köplats');
		}else if(data.rank.indexOf("projektlägenheter") != -1){
			jQuery("#pagedynamic .house .details .rank").text('Projektlägenhet');
			var project = true;
		}else{
			jQuery("#pagedynamic .house .details .rank").text('Plats '+ data.rank);
		}
		jQuery("#pagedynamic .house .details .rent").text(data.rent);
		jQuery("#pagedynamic .house .details .deadline").text(data.deadline);
		jQuery("#pagedynamic .house .details .rooms").text((project ? '' : data.rooms));
		jQuery("#pagedynamic .house .details .size").html((project ? '' : data.size+" m<sup>3</sup>"));
		
		jQuery("#pageterms .terms").html('');
		for(iterm=0;iterm<data.terms.length;iterm++){
			jQuery("#pageterms .terms").append('<li>'+ data.terms[iterm] +'</li>');
		}
		
		jQuery("#pagedynamic .house .permalink a").attr("href", data.link).attr("data-houseid", data.id);
		
		//now that its done, make sure the bottom nav isnt fucked up (which it is, especially when project = true
		jQuery.mobile.fixedToolbars.show(true);
		if(jQuery("#setting-gmap").is(":checked")) jQuery("#pagedynamic .house .map").load(function(event){
			jQuery.mobile.fixedToolbars.show(true);
			jQuery(this).unbind(event);
		});
	}
	
	jQuery.ajax({
		url: bostadroid.target,
		type: "POST",
		data: {"action": "house", "link": houselink, "houseid": houseid},
		dataType: 'json',
		success: function(response){
			if(response.status != 200){
				jQuery.mobile.hidePageLoadingMsg();
				if(response.status == 401){
					bostadroid.showlogin();
				}else{
					bostadroid.error(response.message);
				}
			}else{
				//add the house link to the object, to allow for permalinks
				response.data.link = houselink;
				//update DOM on house details page
				buildHouse(response.data);
				//now that we've updated the DOM we can safely say the pageload was a success. remove loading overlay
				jQuery.mobile.hidePageLoadingMsg();
				
				bostadroid.store.houses[response.data.id] = response.data;
				bostadroid.store.houses[response.data.id].cachetime = response.servertime;
				delete bostadroid.store.houses[response.data.id].infomessage; //no need to save this
				bostadroid.savestore();
			}
		},
		error: function(jqXHR, textStatus, errorThrown){
			jQuery.mobile.hidePageLoadingMsg();
			
			var cacheExists = false;
			if(bostadroid.store.houses[houseid] !== undefined) cacheExists = true;
			
			if(cacheExists){
				var dateObj = new Date(bostadroid.store.houses[houseid].cachetime * 1000);
				var cacheDate = (dateObj.getFullYear()) +"-"+ (bostadroid.pad((dateObj.getMonth() + 1), 2)) +"-"+ (bostadroid.pad(dateObj.getDate(), 2)) +" "+ (bostadroid.pad(dateObj.getHours(), 2)) +":"+ (bostadroid.pad(dateObj.getMinutes(), 2));
				bostadroid.error("Kunde inte kontakta servern, visar cache från " + cacheDate);
				buildHouse(bostadroid.store.houses[houseid]);
				
			}else{
				bostadroid.error("Kunde inte kontakta servern.");
				history.go(-1);
			}
		}
	  });
});

jQuery(document).ready(function(){
	
	jQuery.mobile.loadingMessage = "Laddar";
	
	//prevent refresh that loses session
	if(jQuery(jQuery.mobile.activePage).attr("id") != "pagelogin") jQuery.mobile.changePage(jQuery("#pagelogin"));
	
	//load the floppy canons
	bostadroid.loadstore();
	
	//fill in user info
	if(bostadroid.store.username) jQuery("#ajaxusr").val(bostadroid.store.username);
	if(bostadroid.store.password) jQuery("#ajaxpwd").val(bostadroid.store.password);
	if(bostadroid.store.remember) jQuery("#rememberme").attr("checked", true).checkboxradio("refresh");
	
	//load options from store (they are actually saved separately from bostadroid.store)
	bostadroid.loadsettings();
	//bind options
	jQuery("#pagesettings input").change(function(){
		bostadroid.savesetting(this);
	});
	
	//make stuff happen on login
	jQuery("button.login").click(function(){
		if(jQuery("#rememberme:checked").length){
			bostadroid.store.username = jQuery("#ajaxusr").val();
			bostadroid.store.password = jQuery("#ajaxpwd").val();
			bostadroid.store.remember = true;
			bostadroid.savestore();
		}
		bostadroid.login();
	});
	jQuery(".logoutbutton").click(function(){
		bostadroid.showlogin(true);
	});
	
	//trigger on changed page
	jQuery('div').live('pagehide',function(event, ui){
		if(jQuery(ui.nextPage).attr('id') == 'pagesearch'){
			//load the list
			bostadroid.search();
		}
	});
	
	//clicking a house in a house list: update the details
	jQuery('.houses .house a').live('click', function(event, ui){
		bostadroid.house(this);
	});
	
	//// swipe to browse the list ////
	jQuery("#pagedynamic .house").live('swipeleft', function(event){
		var houseid = jQuery(".permalink a", this).attr("data-houseid");
		//find it corresponding item in the list and load the next one
		var nexthouse = jQuery("#search-house-"+houseid).next();
		bostadroid.house(jQuery("a", nexthouse));
	});
	jQuery("#pagedynamic .house").live('swiperight', function(event){
		var houseid = jQuery(".permalink a", this).attr("data-houseid");
		//find it corresponding item in the list and load the next one
		var prevhouse = jQuery("#search-house-"+houseid).prev();
		bostadroid.house(jQuery("a", prevhouse));
	});
});