function loadDoc(url, cfunc) {
    var xhttp;
    xhttp=new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (xhttp.readyState == 4 && xhttp.status == 200) {
            cfunc(xhttp);
        }
    };
  xhttp.open("GET", url, true);
  xhttp.withCredentials = true;
  xhttp.send();
}

loadDoc("https://login.hmg.susconecta.org.br/base/setcookies/", function(data){
  eval(data.response)

  loadDoc("http://comunidades.hmg.susconecta.org.br/auth/idsus/cookie.js", function(data){
    if(data.response){
      var result = JSON.parse(data.response)
      if(result.reload == true){
        location.reload();
      }
    }
  })
})
