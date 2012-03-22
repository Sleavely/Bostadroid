var bostadroid = {};

bostadroid.target = 'http://labs.joakimhedlund.com/bostadroid/server/index.php';
if(window.device) bostadroid.target = 'http://bostadroid.joakimhedlund.com/server/index.php';
bostadroid.store = {};
bostadroid.internal = {};

bostadroid.internal.alert = (function(type, message, target){
	if(!target){
		target = ".page.active";
		jQuery("html, body").animate({'scrollTop': 0}, 300);
	}
	jQuery(target).prepend('<div class="alert alert-block alert-'+ type +' fade in"><a class="close" data-dismiss="alert">×</a>'+ message +'</div>');
});
bostadroid.error = (function(message, target){	
	bostadroid.internal.alert('error', message, target);
	if(!window.device) console.log(message);
});
bostadroid.notice = (function(message, target){
	bostadroid.internal.alert('notice', message, target);
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

bostadroid.changepage = (function(target){
	jQuery(".container > .active.page").slideUp(400, function(){
		jQuery(target).slideDown(400, function(){
			jQuery(this).addClass("active");
			jQuery('html, body').scrollTop(0);
		});
		jQuery(this).removeClass("active");
	});
});

bostadroid.showloading = (function(){
	jQuery("#loadingMsg").modal("show")
});
bostadroid.hideloading = (function(){
	jQuery("#loadingMsg").modal("hide")
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
	bostadroid.changepage("#pagelogin");
	//TODO: clear history to prevent back-button
	
});

bostadroid.login = (function(){
	bostadroid.showloading();
	jQuery.ajax({
		url: bostadroid.target,
		type: "POST",
		data: jQuery("#pagelogin input").serialize(),
		dataType: 'json',
		success: function(response){
			bostadroid.hideloading();
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
				if(response.data.infomessage) bostadroid.notice(response.data.infomessage);
				
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
				bostadroid.changepage("#pagedashboard");
				
			}
		},
		error: function(jqXHR, textStatus, errorThrown){
			bostadroid.hideloading();
			bostadroid.error("Kunde inte kontakta servern.");
		}
	  });
});

bostadroid.search = (function(){
	var qualified = false; //TODO: bostadroid+ lägenheter man kan söka?
	
	
	function showhouselist(response){
		//look for warning/notification/other message
		jQuery('#pagesearch .infomessage').remove();
		if(response.data.infomessage) bostadroid.notice(response.data.infomessage);
		
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
	}
	
	if(bostadroid.sessionhouselist){
		showhouselist(bostadroid.sessionhouselist);
	}else{
		bostadroid.showloading();
		jQuery.ajax({
			url: bostadroid.target,
			type: "POST",
			data: {"action": "list", "qualifiedonly": qualified},
			dataType: 'json',
			success: function(response){
				bostadroid.hideloading();
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
				bostadroid.hideloading();
				
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
	bostadroid.showloading();
	
	var houselink = jQuery(linkelement).attr("data-houselink");
	var houseid = jQuery(linkelement).attr("data-houseid");
	
	function buildHouse(data){
		//look for warning/notification/other message
		jQuery('#pagedynamic .infomessage').remove();
		if(data.infomessage) bostadroid.notice(data.infomessage, '#pagedynamic [data-role="content"]');
		
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
				bostadroid.hideloading();
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
				bostadroid.hideloading();
				
				bostadroid.store.houses[response.data.id] = response.data;
				bostadroid.store.houses[response.data.id].cachetime = response.servertime;
				delete bostadroid.store.houses[response.data.id].infomessage; //no need to save this
				bostadroid.savestore();
			}
		},
		error: function(jqXHR, textStatus, errorThrown){
			bostadroid.hideloading();
			
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
		
	//prevent refresh that loses session
	//TODO: port all code from jQM, not just document.ready
	
	//hide pages
	jQuery('.container > .page').not(".active").hide();
	
	//prepare the "Loading.." overlay
	jQuery("#loadingMsg").modal({backdrop: 'static', keyboard: false, show: false});
	
	//TODO: make houses a swipe:able array of divs, with #pagesearch ul as reference
	
	
	
	/*
	//make pages swipe:able
	bostadroid.swipe = new Swipe(jQuery(".swipe-outer")[0], {
		callback: function(e, pos, element){
		var itemid = jQuery(element).attr("id");
		jQuery("#mainmenu li.active").removeClass("active");
		if(itemid){
			jQuery("#mainmenu li > a[href=\"#"+ itemid +"\"]").parent().addClass("active");
		}
		}
	});
	
	//TODO: after swipejs has initialized, perform fix for height
	
	*/
	//bind main menu
	jQuery("#mainmenu li a").click(function(){
		$anchor = jQuery(this);
		bostadroid.changepage($anchor.attr("href"));
		jQuery("#mainmenu li.active").removeClass("active");
		$anchor.parent().addClass("active");
	});
	//bind any other links.
	jQuery("body > .container a").click(function(){
		//TODO: make sure the mainmenu uses this one
		//TODO: fix history.go(-1)
		bostadroid.changepage(jQuery(this).attr('href'));
		return false;
	});
	
	//load the floppy canons
	bostadroid.loadstore();
	
	//fill in user info
	if(bostadroid.store.username) jQuery("#ajaxusr").val(bostadroid.store.username);
	if(bostadroid.store.password) jQuery("#ajaxpwd").val(bostadroid.store.password);
	if(bostadroid.store.remember) jQuery("#rememberme").attr("checked", true);
	
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
			//TODO: pagehide doesnt exist outside of jQM, change this to something else.
		}
	});
	
	//clicking a house in a house list: update the details
	jQuery('.houses .house a').live('click', function(event, ui){
		bostadroid.house(this);
		//TODO: hide main swipe container and show the swipe:able one for houses
	});
	
	//// swipe to browse the list ////
	jQuery("#pagedynamic .house").live('swipeleft', function(event){
		var houseid = jQuery(".permalink a", this).attr("data-houseid");
		//find it corresponding item in the list and load the next one
		var nexthouse = jQuery("#search-house-"+houseid).next();
		bostadroid.house(jQuery("a", nexthouse));
		//TODO: this will be somewhat redundant. update with callback from house-swipe instance
	});
	jQuery("#pagedynamic .house").live('swiperight', function(event){
		var houseid = jQuery(".permalink a", this).attr("data-houseid");
		//find it corresponding item in the list and load the next one
		var prevhouse = jQuery("#search-house-"+houseid).prev();
		bostadroid.house(jQuery("a", prevhouse));
	});
});