<?php
require_once("../admin/inc/conecta.php");
require_once("../admin/inc/funcoes.php");

//////////////////////////////////////////////////////////////////
//////////////////////////// Navegação ///////////////////////////
//////////////////////////////////////////////////////////////////

$pagina = query_string('0');

if ($pagina == "") {
die("Acesso Negado! Access Denied!");
}

if (!file_exists($pagina.".php")) {
die("Acesso Negado! Access Denied!");
}

require("".$pagina.".php");
?>
