/**
 * @file
 * Handles webtrekk tracking in the client.
 *
 * Some user interactions that we want to track doesn't result in a page load.
 * These interactions are tracked here with Webtrekk events in the client.
 *
 * Also handles has special handling for some elements, which are problematic
 * to handle in the backend.
 */

(function($) {
  "use strict";

  // Webtrekk tracking parameters.
  var DING_WEBTREKK_PARAMETER_AUTOCOMPLETE = 54;
  var DING_WEBTREKK_PARAMETER_RENEW_SELECTED = 55;
  var DING_WEBTREKK_PARAMETER_RENEW_RATING_ID = 57;
  var DING_WEBTREKK_PARAMETER_RENEW_RATING = 58;
  var DING_WEBTREKK_PARAMETER_CAROUSEL_NEXT = 59;
  var DING_WEBTREKK_PARAMETER_CAROUSEL_PREV = 60;

  var appendQueryParameter = function appendQueryParameter(url, key, value) {
    var seperator = (url.indexOf('?') !== -1) ? '&' : '?';
    var urlParameter = key + '=' + encodeURIComponent(value);
    return url + seperator + urlParameter;
  };

  var pushEvent = function pushEvent(event, eventData) {
    if (Drupal.settings.dingWebtrekk.debugMode) {
      console.log('Ding webtrekk - Pushing ' + event + ' event with data: ',
        JSON.stringify(eventData, null, 2)
      );
    }
    // Ensure that the Webtrekk object is defined before pushing event.
    debugger;
    if (typeof wts !== 'undefined') {
      wts.push(['send', event, eventData]);
    }
  };

  // Enables tracking without cookies. This method uses IP + user agent
  // fingerprinting instead to keep sessions together. Cross session analysis
  // will no longer be possible.
  // TODO: Insert link to documentation when available. As of writing this is
  // very new stuff.
  var noCookieTracking = function noCookieTracking() {
    debugger;
    if (typeof wts !== 'undefined') {
      wts.push(['setIdentifierOptOut']);
    }
  }

  // Other modules dealing with client side webtrekk tracking might find these
  // functions useful, so make them available on the global Drupal object.
  Drupal.dingWebtrekkAppendQueryParameter = appendQueryParameter;
  Drupal.dingWebtrekkPushEvent = pushEvent;
  Drupal.dingWebtrekkNoCookieTracking= noCookieTracking;

  Drupal.behaviors.ding_webtrekk = {
    attach: function(context) {
      // Send Webtrekk events attached in the backend.
      $('.js-ding-webtrekk-event', context)
        .once('js-ding-webtrekk')
        .click(function() {
        var eventData = $(this).data('ding-webtrekk-event');
        pushEvent('click', eventData);
        }
      );

      // Track autocomplete selections.
      $('.js-ding-webtrekk-autocomplete .form-autocomplete', context)
        .once('js-ding-webtrekk')
        .on('autocompleteSelect', function(e, selected) {
          if (($(selected).text())) {
            var eventData = {
              linkId: 'Autocomplete søgning clicks',
              customClickParameter: {}
            };
            eventData.customClickParameter[DING_WEBTREKK_PARAMETER_AUTOCOMPLETE] = $(selected).text();
            pushEvent('click', eventData);
          }
        }
      );

      // Track ding loan renew selected events.
      //
      // The renew all button is attached completely on the server, but for
      // renew selected, we need information about selected loans in the UI,
      // before we send event.
      $('.js-ding-webtrekk-event-renew-selected', context)
        .once('js-ding-webtrekk')
        .click(function(e) {
          // The renew-all button is implemented by checking all renewable loans
          // and then trigger a click on the renew-selected button. We can use
          // originalEvent to check for this.
          if (e.originalEvent === undefined) {
            return;
          }

          var selectedMaterials = [];
          $('.material-item input[type=checkbox]:checked').each(function() {
            // We have collected the material ids (pids) in our event data
            // attribute for each select box.
            selectedMaterials.push($(this).data('ding-webtrekk-event'));
          });

          var eventData = {
            linkId: 'Forny valgte materialer',
            customClickParameter: {}
          };
          eventData.customClickParameter[DING_WEBTREKK_PARAMETER_RENEW_SELECTED] = selectedMaterials.join(';');
          pushEvent('click', eventData);
      });

      // Special handling for ding_carousel.
      //
      // The primary reason for this is that we need the title of the carousel
      // to pass as value in event and URL-parameter. For tabbed carousels the
      // title of the individuals carousels in the tabs are set in the
      // data-title attribute of the carousels. For single carousels the title
      // is not available here, but instead it's controlled by the configuration
      // on the panel pane. There are no panel hooks where we can get the title
      // and easily change the content tree to add event and URL-parameters to
      // elements (content is already rendered when hook is run).
      // Note that 'once' and 'context' is left out intentionally in the outer
      // most selector. This is because items in the carousel are lazy loaded
      // and we want to make sure the selector applies when new items is added.
      $('.obb-carousel').each(function() {
        var key = 'u_navigatedby';
        // We need a title to send as value in the 'u_navigatedby' parameter, so
        // if we can't find a carousel title we will just have to fallback to
        // this generic one.
        var carouselTitle = 'unknown_carousel';        
        carouselTitle = $('.obb-carousel-active-tab h3').text();
        // Add tracking URL-pararmeters to items in the carousel.
        $('.carousel-inner a[href^="/ting/object/"]', this).once('js-ding-webtrekk', function() {                  
          $(this).attr('href', appendQueryParameter($(this).attr('href'), key, carouselTitle));
        });

        $('.prev', this).once('js-ding-webtrekk').click(function() {
          var linkId = 'Karousel, click på forrige knappen';
          var wtkId = DING_WEBTREKK_PARAMETER_CAROUSEL_PREV;

          if ($(this).hasClass('next')) {
            linkId = 'Karousel, click på næste knappen';
            wtkId = DING_WEBTREKK_PARAMETER_CAROUSEL_NEXT;
          }

          var eventData = {
            linkId: linkId,
            customClickParameter: {}
          };
          eventData.customClickParameter[wtkId] = carouselTitle;
          pushEvent('click', eventData);
        });
      });

      // Track loaded ding_campaign_plus campaigns.
      //
      // Sometimes campaigns are loaded asynchronously if they are not in cache.
      // In these cases we can't use page parameters, since we don't have the
      // required information at initial page load and we'll have to use an
      // event. To be consistent we track every campaign with event.
      $('.node-ding-campaign-plus', context) .once('js-ding-webtrekk', function() {
        var eventData = $(this).data('ding-webtrekk-event');
        // Sending a 'click'-event to webtrekk in this case may seem weird, but
        // currently our Webtrekk setup only supports this type of event. If our
        // setup is changed in the future it may be more appropriate to send
        // another type of event. The important thing now is that we get the
        // data to Webtrekk.
        pushEvent('click', eventData);
      });
    }
  };

  // EU cookie compliance integration.
  if (typeof Drupal.eu_cookie_compliance !== 'undefined') {
    var method = Drupal.settings.eu_cookie_compliance.method;
    // When using opt-in enable no-cookie tracking if user hasn't agreed.
    // When using opt-out enable no-cookie tracking if user has disagreed. Since
    // there's no method for that, we check for the value explicitly.
    if ((method === 'opt_in' && !Drupal.eu_cookie_compliance.hasAgreed())
        || (method === 'opt_out' && Drupal.eu_cookie_compliance.getCurrentStatus() === 0)) {
      noCookieTracking();
    }
  }

})(jQuery);
